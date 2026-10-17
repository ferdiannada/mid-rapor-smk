package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

type clientLimiter struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

type IPRateLimiter struct {
	clients map[string]*clientLimiter
	mu      sync.RWMutex
	rate    rate.Limit
	burst   int
}

func NewIPRateLimiter(r rate.Limit, b int) *IPRateLimiter {
	i := &IPRateLimiter{
		clients: make(map[string]*clientLimiter),
		rate:    r,
		burst:   b,
	}

	// Periodically cleanup stale clients every 5 minutes
	go func() {
		for {
			time.Sleep(5 * time.Minute)
			i.mu.Lock()
			for ip, client := range i.clients {
				if time.Since(client.lastSeen) > 10*time.Minute {
					delete(i.clients, ip)
				}
			}
			i.mu.Unlock()
		}
	}()

	return i
}

func (i *IPRateLimiter) getLimiter(ip string) *rate.Limiter {
	i.mu.Lock()
	defer i.mu.Unlock()

	client, exists := i.clients[ip]
	if !exists {
		limiter := rate.NewLimiter(i.rate, i.burst)
		i.clients[ip] = &clientLimiter{limiter: limiter, lastSeen: time.Now()}
		return limiter
	}

	client.lastSeen = time.Now()
	return client.limiter
}

// RateLimitMiddleware protects API from traffic spikes & DDoS
func RateLimitMiddleware(r rate.Limit, b int) gin.HandlerFunc {
	limiter := NewIPRateLimiter(r, b)

	return func(c *gin.Context) {
		ip := c.ClientIP()
		l := limiter.getLimiter(ip)

		if !l.Allow() {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"status":  "error",
				"message": "Terlalu banyak permintaan dalam waktu singkat. Mohon tunggu beberapa saat...",
			})
			return
		}

		c.Next()
	}
}
