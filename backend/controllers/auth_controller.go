package controllers

import (
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"rapor-smk-backend/config"
	"rapor-smk-backend/models"
	"rapor-smk-backend/utils"
)

type AuthController struct {
	cfg *config.Config
}

func NewAuthController(cfg *config.Config) *AuthController {
	return &AuthController{cfg: cfg}
}

type LoginInput struct {
	Identifier string `json:"identifier" binding:"required"` // NIP / NIK / Email
	Password   string `json:"password" binding:"required"`
}

func (ctrl *AuthController) Login(c *gin.Context) {
	var input LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "NIP/NIK/Email dan Kata Sandi wajib diisi",
		})
		return
	}

	identifier := strings.TrimSpace(input.Identifier)
	db := config.DB

	var user models.User
	err := db.Where("LOWER(email) = LOWER(?) OR nip_nik = ?", identifier, identifier).First(&user).Error
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"status":  "error",
			"message": "Akun tidak ditemukan atau NIP/NIK/Email salah",
		})
		return
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"status":  "error",
			"message": "Kata sandi yang Anda masukkan salah",
		})
		return
	}

	// Check if account is active
	if !user.IsActive {
		c.JSON(http.StatusUnauthorized, gin.H{
			"status":  "error",
			"message": "Akun Anda telah dinonaktifkan oleh Administrator",
		})
		return
	}

	// Generate JWT
	token, err := utils.GenerateToken(&user, ctrl.cfg.JWTSecret, ctrl.cfg.JWTExpiryHours)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Gagal membuat sesi login",
		})
		return
	}

	// Check if this user is a wali kelas
	rombelPerwalian := getActiveWaliRombel(user.ID)

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Login berhasil",
		"token":   token,
		"user": gin.H{
			"id":                  user.ID,
			"name":                user.Name,
			"email":               user.Email,
			"role":                user.Role,
			"nip_nik":             user.NipNik,
			"phone":               user.Phone,
			"is_initial_password": user.IsInitialPassword,
			"wali_kelas_rombel":   rombelPerwalian,
		},
	})
}

type ChangePasswordInput struct {
	OldPassword string `json:"old_password"`
	NewPassword string `json:"new_password" binding:"required,min=6"`
}

func (ctrl *AuthController) ChangePassword(c *gin.Context) {
	var input ChangePasswordInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Kata sandi baru minimal harus terdiri dari 6 karakter",
		})
		return
	}

	userID, _ := c.Get("user_id")
	userIDStr, ok := userID.(string)
	if !ok || userIDStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "Sesi tidak valid"})
		return
	}

	db := config.DB
	var user models.User
	if err := db.First(&user, "id = ?", userIDStr).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Pengguna tidak ditemukan"})
		return
	}

	// Strict check: if not initial password, old_password is REQUIRED and must match
	if !user.IsInitialPassword {
		if input.OldPassword == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  "error",
				"message": "Kata sandi lama wajib diisi",
			})
			return
		}
		if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.OldPassword)); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  "error",
				"message": "Kata sandi lama yang Anda masukkan tidak sesuai",
			})
			return
		}
	}

	// Hash new password
	newHash, err := bcrypt.GenerateFromPassword([]byte(input.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Gagal mengenkripsi kata sandi baru",
		})
		return
	}

	user.PasswordHash = string(newHash)
	user.IsInitialPassword = false
	user.UpdatedAt = time.Now()

	if err := db.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Gagal memperbarui kata sandi di database",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Kata sandi berhasil diperbarui. Silakan gunakan kata sandi baru untuk login berikutnya.",
	})
}

func (ctrl *AuthController) GetMe(c *gin.Context) {
	userID, _ := c.Get("user_id")
	userIDStr, ok := userID.(string)
	if !ok || userIDStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "Sesi tidak valid"})
		return
	}

	db := config.DB
	var user models.User
	if err := db.First(&user, "id = ?", userIDStr).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Pengguna tidak ditemukan"})
		return
	}

	rombelPerwalian := getActiveWaliRombel(user.ID)

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"user": gin.H{
			"id":                  user.ID,
			"name":                user.Name,
			"email":               user.Email,
			"role":                user.Role,
			"nip_nik":             user.NipNik,
			"phone":               user.Phone,
			"dapodik_id":          user.DapodikID,
			"is_initial_password": user.IsInitialPassword,
			"wali_kelas_rombel":   rombelPerwalian,
		},
	})
}

// getActiveWaliRombel mencari rombel binaan untuk guru.
// Jika seorang guru mengampu wali kelas lebih dari 1 kelas (>= 2),
// hilangkan kelas yang siswanya 0 dan utamakan kelas yang memiliki siswa.
func getActiveWaliRombel(userID string) *models.Rombel {
	db := config.DB
	if db == nil {
		return nil
	}

	var rombels []models.Rombel
	if err := db.Where("wali_kelas_id = ?", userID).Find(&rombels).Error; err != nil || len(rombels) == 0 {
		return nil
	}

	if len(rombels) == 1 {
		return &rombels[0]
	}

	// Jika mengampu lebih dari 1 kelas (>= 2), hitung siswa dan prioritaskan rombel yang memiliki siswa > 0
	type RCount struct {
		RombelID string `gorm:"column:rombel_id"`
		Count    int64  `gorm:"column:count"`
	}
	var rCounts []RCount
	rombelIDs := make([]string, len(rombels))
	for i, rb := range rombels {
		rombelIDs[i] = rb.ID
	}
	db.Model(&models.Student{}).
		Select("rombel_id, count(*) as count").
		Where("rombel_id IN ?", rombelIDs).
		Group("rombel_id").
		Scan(&rCounts)

	countMap := make(map[string]int64, len(rCounts))
	for _, rc := range rCounts {
		countMap[rc.RombelID] = rc.Count
	}

	var withStudents []models.Rombel
	for _, rb := range rombels {
		rb.StudentCount = countMap[rb.ID]
		if rb.StudentCount > 0 {
			withStudents = append(withStudents, rb)
		}
	}

	if len(withStudents) > 0 {
		sort.Slice(withStudents, func(i, j int) bool {
			if withStudents[i].StudentCount != withStudents[j].StudentCount {
				return withStudents[i].StudentCount > withStudents[j].StudentCount
			}
			return withStudents[i].Name < withStudents[j].Name
		})
		return &withStudents[0]
	}

	return &rombels[0]
}
