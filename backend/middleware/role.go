package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"rapor-smk-backend/models"
)

func RoleMiddleware(allowedRoles ...models.UserRole) gin.HandlerFunc {
	return func(c *gin.Context) {
		roleVal, exists := c.Get("role")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{
				"status":  "error",
				"message": "Role pengguna tidak terdefinisi.",
			})
			c.Abort()
			return
		}

		userRole, ok := roleVal.(models.UserRole)
		if !ok {
			// In case it was stored as string
			if strVal, isStr := roleVal.(string); isStr {
				userRole = models.UserRole(strVal)
			}
		}

		allowed := false
		for _, role := range allowedRoles {
			if userRole == role {
				allowed = true
				break
			}
		}

		if !allowed {
			c.JSON(http.StatusForbidden, gin.H{
				"status":  "error",
				"message": "Akses ditolak. Anda tidak memiliki izin untuk mengakses resource ini.",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
