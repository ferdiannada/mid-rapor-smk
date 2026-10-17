package config

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type AppEnv string

const (
	EnvDevelopment AppEnv = "development"
	EnvStaging     AppEnv = "staging"
	EnvProduction  AppEnv = "production"
)

type Config struct {
	AppEnv  AppEnv
	AppName string
	Port    int

	// Database
	DBHost     string
	DBPort     int
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string

	// Redis
	RedisHost     string
	RedisPassword string
	RedisDB       int

	// Auth
	JWTSecret      string
	JWTExpiryHours int

	// CORS
	AllowedOrigins []string

	// Dapodik Fallbacks
	DapodikHost  string
	DapodikPort  int
	DapodikToken string
	NPSN         string
}

func Load() (*Config, error) {
	// Attempt to load .env if present
	_ = godotenv.Load()

	env := AppEnv(strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV"))))
	if env == "" {
		env = EnvDevelopment
	}

	rawDapodikURL := os.Getenv("DAPODIK_URL")
	dapHost := "localhost"
	dapPort := 5774
	if rawDapodikURL != "" {
		cleaned := strings.TrimPrefix(strings.TrimPrefix(rawDapodikURL, "http://"), "https://")
		parts := strings.Split(cleaned, ":")
		if len(parts) > 0 && parts[0] != "" {
			dapHost = parts[0]
		}
		if len(parts) > 1 {
			if p, err := strconv.Atoi(parts[1]); err == nil {
				dapPort = p
			}
		}
	}
	if pStr := os.Getenv("DAPODIK_PORT"); pStr != "" {
		if p, err := strconv.Atoi(pStr); err == nil {
			dapPort = p
		}
	}

	cfg := &Config{
		AppEnv:  env,
		AppName: getEnv("APP_NAME", "rapor-smk-backend"),
		Port:    getEnvInt("PORT", 8080),

		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnvInt("DB_PORT", 5432),
		DBUser:     getEnv("DB_USER", "postgres"),
		DBPassword: getEnv("DB_PASSWORD", "postgrespassword"),
		DBName:     getEnv("DB_NAME", "rapor_smk"),
		DBSSLMode:  getEnv("DB_SSLMODE", "disable"),

		RedisHost:     getEnv("REDIS_HOST", "localhost:6379"),
		RedisPassword: os.Getenv("REDIS_PASSWORD"),
		RedisDB:       getEnvInt("REDIS_DB", 0),

		JWTSecret:      os.Getenv("JWT_SECRET"),
		JWTExpiryHours: getEnvInt("JWT_EXPIRY_HOURS", 24),

		DapodikHost:  dapHost,
		DapodikPort:  dapPort,
		DapodikToken: os.Getenv("DAPODIK_TOKEN"),
		NPSN:         os.Getenv("NPSN"),
	}

	if raw := os.Getenv("ALLOWED_ORIGINS"); raw != "" {
		for _, o := range strings.Split(raw, ",") {
			o = strings.TrimSpace(o)
			if o != "" {
				cfg.AllowedOrigins = append(cfg.AllowedOrigins, o)
			}
		}
	}

	if err := cfg.validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

func (c *Config) validate() error {
	if c.IsProduction() {
		if c.JWTSecret == "" || len(c.JWTSecret) < 16 {
			return fmt.Errorf("JWT_SECRET must be at least 16 characters in production")
		}
		if c.DBSSLMode == "disable" {
			return fmt.Errorf("DB_SSLMODE=disable is not allowed in production")
		}
		if len(c.AllowedOrigins) == 0 {
			return fmt.Errorf("ALLOWED_ORIGINS must be set in production")
		}
	} else {
		if c.JWTSecret == "" {
			c.JWTSecret = generateRandomSecret()
		}
		if len(c.AllowedOrigins) == 0 {
			c.AllowedOrigins = []string{
				"http://localhost:5173",
				"http://localhost:3000",
				"http://localhost:8080",
				"http://127.0.0.1:5173",
				"http://127.0.0.1:8080",
			}
		}
	}
	return nil
}

func (c *Config) IsProduction() bool  { return c.AppEnv == EnvProduction }
func (c *Config) IsDevelopment() bool { return c.AppEnv == EnvDevelopment }

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}

func generateRandomSecret() string {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "rapor_smk_dev_jwt_secret_key_32_characters_long"
	}
	return hex.EncodeToString(bytes)
}
