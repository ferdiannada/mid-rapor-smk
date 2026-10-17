package controllers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"rapor-smk-backend/config"
	"rapor-smk-backend/models"
)

type LearningObjectiveController struct{}

func NewLearningObjectiveController() *LearningObjectiveController {
	return &LearningObjectiveController{}
}

// verifyTeacherSubjectOrAdmin checks that user is Admin OR teaches this subject
func verifyTeacherSubjectOrAdmin(db *gorm.DB, c *gin.Context, subjectID string) bool {
	userRole, _ := c.Get("user_role")
	if userRole == string(models.RoleAdmin) {
		return true
	}
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "Sesi tidak valid"})
		return false
	}
	var count int64
	db.Model(&models.TeachingAssignment{}).Where("guru_id = ? AND subject_id = ?", userID, subjectID).Count(&count)
	if count == 0 {
		c.JSON(http.StatusForbidden, gin.H{
			"status":  "error",
			"message": "Akses ditolak: Anda tidak ditugaskan mengajar mata pelajaran ini",
		})
		return false
	}
	return true
}

func (ctrl *LearningObjectiveController) GetBySubject(c *gin.Context) {
	subjectID := c.Param("id")
	db := config.DB

	var tps []models.LearningObjective
	if err := db.Where("subject_id = ?", subjectID).Order("urutan ASC, kode_tp ASC").Find(&tps).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Gagal mengambil data tujuan pembelajaran",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":              "success",
		"learning_objectives": tps,
		"count":               len(tps),
	})
}

type CreateTPInput struct {
	KodeTP    string `json:"kode_tp" binding:"required"`
	Deskripsi string `json:"deskripsi" binding:"required"`
	Urutan    int    `json:"urutan"`
}

func (ctrl *LearningObjectiveController) Create(c *gin.Context) {
	subjectID := c.Param("id")
	db := config.DB

	if !verifyTeacherSubjectOrAdmin(db, c, subjectID) {
		return
	}

	var input CreateTPInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Kode TP dan Deskripsi wajib diisi",
		})
		return
	}

	urutan := input.Urutan
	if urutan <= 0 {
		urutan = 1
	}

	tp := models.LearningObjective{
		ID:        uuid.NewString(),
		SubjectID: subjectID,
		KodeTP:    input.KodeTP,
		Deskripsi: input.Deskripsi,
		Urutan:    urutan,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := db.Create(&tp).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Gagal menambahkan Tujuan Pembelajaran (pastikan Kode TP belum pernah digunakan pada mapel ini)",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":             "success",
		"message":            "Tujuan Pembelajaran berhasil ditambahkan",
		"learning_objective": tp,
	})
}

type UpdateTPInput struct {
	KodeTP    string `json:"kode_tp"`
	Deskripsi string `json:"deskripsi"`
	Urutan    int    `json:"urutan"`
}

func (ctrl *LearningObjectiveController) Update(c *gin.Context) {
	tpID := c.Param("id")
	var input UpdateTPInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Format data tidak valid"})
		return
	}

	db := config.DB
	var tp models.LearningObjective
	if err := db.First(&tp, "id = ?", tpID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Tujuan Pembelajaran tidak ditemukan"})
		return
	}

	if !verifyTeacherSubjectOrAdmin(db, c, tp.SubjectID) {
		return
	}

	if input.KodeTP != "" {
		tp.KodeTP = input.KodeTP
	}
	if input.Deskripsi != "" {
		tp.Deskripsi = input.Deskripsi
	}
	if input.Urutan > 0 {
		tp.Urutan = input.Urutan
	}
	tp.UpdatedAt = time.Now()

	if err := db.Save(&tp).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal memperbarui Tujuan Pembelajaran"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":             "success",
		"message":            "Tujuan Pembelajaran berhasil diperbarui",
		"learning_objective": tp,
	})
}

func (ctrl *LearningObjectiveController) Delete(c *gin.Context) {
	tpID := c.Param("id")
	db := config.DB

	var tp models.LearningObjective
	if err := db.First(&tp, "id = ?", tpID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Tujuan Pembelajaran tidak ditemukan"})
		return
	}

	if !verifyTeacherSubjectOrAdmin(db, c, tp.SubjectID) {
		return
	}

	if err := db.Delete(&tp).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal menghapus Tujuan Pembelajaran"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Tujuan Pembelajaran berhasil dihapus",
	})
}
