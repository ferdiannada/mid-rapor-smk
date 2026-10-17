package controllers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"rapor-smk-backend/config"
	"rapor-smk-backend/models"
)

type SemesterController struct{}

func NewSemesterController() *SemesterController {
	return &SemesterController{}
}

func (ctrl *SemesterController) ListSemesters(c *gin.Context) {
	db := config.DB
	var semesters []models.Semester
	if err := db.Order("created_at DESC").Find(&semesters).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Gagal mengambil daftar semester",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":    "success",
		"semesters": semesters,
	})
}

type CreateSemesterInput struct {
	TahunAjaran string `json:"tahun_ajaran" binding:"required"`
	Semester    int    `json:"semester" binding:"required"`
	JenisRapor  string `json:"jenis_rapor"`
	IsActive    bool   `json:"is_active"`
}

func (ctrl *SemesterController) CreateSemester(c *gin.Context) {
	var input CreateSemesterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Tahun ajaran dan semester (1/2) wajib diisi",
		})
		return
	}

	jenisRapor := input.JenisRapor
	if jenisRapor == "" {
		jenisRapor = "mid"
	}

	db := config.DB
	newSemester := models.Semester{
		ID:          uuid.NewString(),
		TahunAjaran: input.TahunAjaran,
		Semester:    input.Semester,
		JenisRapor:  jenisRapor,
		IsActive:    input.IsActive,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		if input.IsActive {
			if err := tx.Model(&models.Semester{}).Where("is_active = ?", true).Update("is_active", false).Error; err != nil {
				return err
			}
		}
		return tx.Create(&newSemester).Error
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Gagal membuat semester baru",
		})
		return
	}

	if config.RDB != nil {
		_ = config.RDB.Del(config.RedisCtx, "dashboard:stats").Err()
	}

	c.JSON(http.StatusOK, gin.H{
		"status":   "success",
		"message":  "Semester berhasil dibuat",
		"semester": newSemester,
	})
}

func (ctrl *SemesterController) ActivateSemester(c *gin.Context) {
	semesterID := c.Param("id")
	db := config.DB

	var sem models.Semester
	if err := db.First(&sem, "id = ?", semesterID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"status":  "error",
			"message": "Data semester tidak ditemukan",
		})
		return
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.Semester{}).Where("is_active = ?", true).Update("is_active", false).Error; err != nil {
			return err
		}
		return tx.Model(&models.Semester{}).Where("id = ?", semesterID).Update("is_active", true).Error
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Gagal mengaktifkan semester",
		})
		return
	}

	if config.RDB != nil {
		_ = config.RDB.Del(config.RedisCtx, "dashboard:stats").Err()
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": fmt.Sprintf("Semester %s (Semester %d) berhasil diaktifkan", sem.TahunAjaran, sem.Semester),
	})
}

func (ctrl *SemesterController) DeleteSemester(c *gin.Context) {
	semesterID := c.Param("id")
	db := config.DB

	if err := db.Delete(&models.Semester{}, "id = ?", semesterID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Gagal menghapus semester",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Semester berhasil dihapus",
	})
}
