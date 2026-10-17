package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"rapor-smk-backend/config"
	"rapor-smk-backend/utils"
)

func AuthMiddleware(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"status":  "error",
				"message": "Token otentikasi tidak ditemukan. Silakan login terlebih dahulu.",
			})
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			c.JSON(http.StatusUnauthorized, gin.H{
				"status":  "error",
				"message": "Format header otentikasi tidak valid. Gunakan format 'Bearer <token>'.",
			})
			c.Abort()
			return
		}

		tokenStr := strings.TrimSpace(parts[1])
		claims, err := utils.ValidateToken(tokenStr, cfg.JWTSecret)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"status":  "error",
				"message": "Token tidak valid atau telah kedaluwarsa. Silakan login kembali.",
				"error":   err.Error(),
			})
			c.Abort()
			return
		}

		// Store in context
		c.Set("user_id", claims.UserID)
		c.Set("email", claims.Email)
		c.Set("name", claims.Name)
		c.Set("role", claims.Role)
		c.Set("user_role", string(claims.Role))
		c.Set("is_initial_password", claims.IsInitialPassword)

		c.Next()
	}
}
