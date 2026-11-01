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

	userRole, _ := c.Get("user_role")
	userID, _ := c.Get("user_id")

	var tps []models.LearningObjective

	if userRole == string(models.RoleGuru) && userID != nil {
		// Guru mandiri: ambil TP milik guru yang sedang login
		db.Where("subject_id = ? AND guru_id = ?", subjectID, userID).
			Order("urutan ASC, kode_tp ASC").
			Find(&tps)

		// Fallback: Jika guru belum pernah membuat TP mandiri, tampilkan TP bawaan/global (guru_id NULL atau kosong)
		if len(tps) == 0 {
			db.Where("subject_id = ? AND (guru_id IS NULL OR guru_id = '')", subjectID).
				Order("urutan ASC, kode_tp ASC").
				Find(&tps)
		}
	} else {
		// Admin: dapat memfilter dengan query param ?guru_id=... atau melihat semua
		guruIDParam := c.Query("guru_id")
		query := db.Where("subject_id = ?", subjectID)
		if guruIDParam != "" {
			if guruIDParam == "global" {
				query = query.Where("guru_id IS NULL OR guru_id = ''")
			} else {
				query = query.Where("guru_id = ?", guruIDParam)
			}
		}
		if err := query.Preload("Guru").Order("urutan ASC, kode_tp ASC").Find(&tps).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  "error",
				"message": "Gagal mengambil data tujuan pembelajaran",
			})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status":              "success",
		"learning_objectives": tps,
		"count":               len(tps),
	})
}

type CreateTPInput struct {
	KodeTP    string  `json:"kode_tp" binding:"required"`
	Deskripsi string  `json:"deskripsi" binding:"required"`
	Urutan    int     `json:"urutan"`
	GuruID    *string `json:"guru_id"`
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

	userRole, _ := c.Get("user_role")
	userID, _ := c.Get("user_id")

	var guruID *string
	if userRole == string(models.RoleGuru) {
		if uid, ok := userID.(string); ok && uid != "" {
			guruID = &uid
		}
	} else if input.GuruID != nil && *input.GuruID != "" {
		guruID = input.GuruID
	}

	urutan := input.Urutan
	if urutan <= 0 {
		urutan = 1
	}

	// Validasi kode TP unik per guru dan subject
	var dupCount int64
	dupQuery := db.Model(&models.LearningObjective{}).Where("subject_id = ? AND kode_tp = ?", subjectID, input.KodeTP)
	if guruID != nil && *guruID != "" {
		dupQuery = dupQuery.Where("guru_id = ?", *guruID)
	} else {
		dupQuery = dupQuery.Where("guru_id IS NULL OR guru_id = ''")
	}
	dupQuery.Count(&dupCount)
	if dupCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Kode TP '" + input.KodeTP + "' sudah pernah Anda gunakan pada mata pelajaran ini",
		})
		return
	}

	tp := models.LearningObjective{
		ID:        uuid.NewString(),
		SubjectID: subjectID,
		GuruID:    guruID,
		KodeTP:    input.KodeTP,
		Deskripsi: input.Deskripsi,
		Urutan:    urutan,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := db.Create(&tp).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Gagal menambahkan Tujuan Pembelajaran: " + err.Error(),
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

	userRole, _ := c.Get("user_role")
	userID, _ := c.Get("user_id")

	// Jika guru, pastikan hanya mengedit TP miliknya sendiri
	if userRole != string(models.RoleAdmin) {
		if tp.GuruID == nil || *tp.GuruID == "" {
			c.JSON(http.StatusForbidden, gin.H{
				"status":  "error",
				"message": "Akses ditolak: Tujuan Pembelajaran bawaan sistem tidak dapat diubah oleh guru. Silakan tambahkan TP mandiri baru.",
			})
			return
		}
		if userID == nil || *tp.GuruID != userID.(string) {
			c.JSON(http.StatusForbidden, gin.H{
				"status":  "error",
				"message": "Akses ditolak: Anda hanya dapat mengubah Tujuan Pembelajaran milik Anda sendiri",
			})
			return
		}
	}

	// Validasi kode TP jika diubah
	if input.KodeTP != "" && input.KodeTP != tp.KodeTP {
		var dupCount int64
		dupQuery := db.Model(&models.LearningObjective{}).
			Where("id != ? AND subject_id = ? AND kode_tp = ?", tp.ID, tp.SubjectID, input.KodeTP)
		if tp.GuruID != nil && *tp.GuruID != "" {
			dupQuery = dupQuery.Where("guru_id = ?", *tp.GuruID)
		} else {
			dupQuery = dupQuery.Where("guru_id IS NULL OR guru_id = ''")
		}
		dupQuery.Count(&dupCount)
		if dupCount > 0 {
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  "error",
				"message": "Kode TP '" + input.KodeTP + "' sudah pernah Anda gunakan pada mata pelajaran ini",
			})
			return
		}
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

	userRole, _ := c.Get("user_role")
	userID, _ := c.Get("user_id")

	// Jika guru, pastikan hanya menghapus TP miliknya sendiri
	if userRole != string(models.RoleAdmin) {
		if tp.GuruID == nil || *tp.GuruID == "" {
			c.JSON(http.StatusForbidden, gin.H{
				"status":  "error",
				"message": "Akses ditolak: Tujuan Pembelajaran bawaan sistem tidak dapat dihapus oleh guru.",
			})
			return
		}
		if userID == nil || *tp.GuruID != userID.(string) {
			c.JSON(http.StatusForbidden, gin.H{
				"status":  "error",
				"message": "Akses ditolak: Anda hanya dapat menghapus Tujuan Pembelajaran milik Anda sendiri",
			})
			return
		}
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
