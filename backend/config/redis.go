package config

import (
	"context"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

var RDB *redis.Client
var RedisCtx = context.Background()

func InitRedis(cfg *Config) {
	RDB = redis.NewClient(&redis.Options{
		Addr:         cfg.RedisHost,
		Password:     cfg.RedisPassword,
		DB:           cfg.RedisDB,
		PoolSize:     64,
		MinIdleConns: 5,
		DialTimeout:  3 * time.Second,
		ReadTimeout:  2 * time.Second,
		WriteTimeout: 2 * time.Second,
	})

	ctx, cancel := context.WithTimeout(RedisCtx, 2*time.Second)
	defer cancel()

	_, err := RDB.Ping(ctx).Result()
	if err != nil {
		log.Printf("[Redis Warning] Failed to connect to Redis at %s: %v. Running in fallback mode.", cfg.RedisHost, err)
		RDB = nil
		return
	}

	log.Printf("Connected to Redis at %s (DB=%d)", cfg.RedisHost, cfg.RedisDB)
}
