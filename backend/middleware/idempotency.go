package middleware

import (
	"bytes"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"rapor-smk-backend/config"
)

type memoryIdempotencyEntry struct {
	status    int
	body      []byte
	expiresAt time.Time
}

var (
	memoryIdempotencyMap  = make(map[string]memoryIdempotencyEntry)
	memoryIdempotencyLock sync.RWMutex
)

type responseBodyWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (w responseBodyWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

func (w responseBodyWriter) WriteString(s string) (int, error) {
	w.body.WriteString(s)
	return w.ResponseWriter.WriteString(s)
}

// IdempotencyMiddleware prevents duplicate execution of batch mutations
// using either Redis or an in-memory fallback cache with a 24-hour TTL.
func IdempotencyMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Only check idempotent mutations (POST, PUT, PATCH)
		if c.Request.Method != http.MethodPost && c.Request.Method != http.MethodPut && c.Request.Method != http.MethodPatch {
			c.Next()
			return
		}

		idempotencyKey := c.GetHeader("Idempotency-Key")
		if idempotencyKey == "" {
			c.Next()
			return
		}

		userID, _ := c.Get("user_id")
		cacheKey := fmt.Sprintf("idempotency:%v:%s", userID, idempotencyKey)

		// 1. Try Redis cache
		if config.RDB != nil {
			cachedVal, err := config.RDB.Get(config.RedisCtx, cacheKey).Result()
			if err == nil && cachedVal != "" {
				c.Header("X-Idempotent-Replay", "true")
				c.Data(http.StatusOK, "application/json; charset=utf-8", []byte(cachedVal))
				c.Abort()
				return
			}
		} else {
			// 2. Try In-memory fallback
			memoryIdempotencyLock.RLock()
			entry, found := memoryIdempotencyMap[cacheKey]
			memoryIdempotencyLock.RUnlock()

			if found && time.Now().Before(entry.expiresAt) {
				c.Header("X-Idempotent-Replay", "true")
				c.Data(entry.status, "application/json; charset=utf-8", entry.body)
				c.Abort()
				return
			}
		}

		// Intercept response to cache it if successful
		w := &responseBodyWriter{
			body:           bytes.NewBuffer(nil),
			ResponseWriter: c.Writer,
		}
		c.Writer = w

		c.Next()

		// If response was 2xx success, cache the response body
		if w.Status() >= 200 && w.Status() < 300 {
			respBody := w.body.Bytes()
			ttl := 24 * time.Hour

			if config.RDB != nil {
				_ = config.RDB.Set(config.RedisCtx, cacheKey, string(respBody), ttl).Err()
			} else {
				memoryIdempotencyLock.Lock()
				// Simple cleanup if map grows too large
				if len(memoryIdempotencyMap) > 5000 {
					now := time.Now()
					for k, v := range memoryIdempotencyMap {
						if now.After(v.expiresAt) {
							delete(memoryIdempotencyMap, k)
						}
					}
				}
				memoryIdempotencyMap[cacheKey] = memoryIdempotencyEntry{
					status:    w.Status(),
					body:      respBody,
					expiresAt: time.Now().Add(ttl),
				}
				memoryIdempotencyLock.Unlock()
			}
		}
	}
}
