package config

import (
	"fmt"
	"log"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB(cfg *Config) {
	dsn := fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%d sslmode=%s TimeZone=Asia/Jakarta",
		cfg.DBHost, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBPort, cfg.DBSSLMode,
	)

	gormLogLevel := logger.Warn
	if cfg.IsDevelopment() {
		gormLogLevel = logger.Info
	}

	var err error
	maxRetries := 5
	for i := 1; i <= maxRetries; i++ {
		DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
			Logger:                 logger.Default.LogMode(gormLogLevel),
			SkipDefaultTransaction: true,
			NowFunc:                func() time.Time { return time.Now() },
			PrepareStmt:            true,
		})
		if err == nil {
			break
		}
		log.Printf("[%d/%d] Gagal menghubungkan ke PostgreSQL: %v. Mencoba kembali dalam 2 detik...", i, maxRetries, err)
		time.Sleep(2 * time.Second)
	}
	if err != nil {
		log.Fatalf("Failed to connect to PostgreSQL after %d attempts: %v", maxRetries, err)
	}

	sqlDB, err := DB.DB()
	if err != nil {
		log.Fatalf("Failed to obtain *sql.DB: %v", err)
	}
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetMaxIdleConns(25)
	sqlDB.SetConnMaxIdleTime(5 * time.Minute)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)

	log.Printf("Connected to PostgreSQL %s:%d/%s (env=%s)", cfg.DBHost, cfg.DBPort, cfg.DBName, cfg.AppEnv)

}
