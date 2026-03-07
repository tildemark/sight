package state

import (
	"context"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
	"sight/internal/logger"
)

type RedisClient struct {
	client *redis.Client
	log    *logger.Logger
}

func NewRedisClient(addr string, password string, db int, log *logger.Logger) (*RedisClient, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password, // no password set
		DB:       db,       // use default DB
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("redis ping failed: %w", err)
	}

	return &RedisClient{
		client: rdb,
		log:    log,
	}, nil
}

func (r *RedisClient) Close() error {
	r.log.Info("Closing Redis connection")
	return r.client.Close()
}
