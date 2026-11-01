package controllers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/sync/singleflight"
	"gorm.io/gorm"
	"rapor-smk-backend/config"
	"rapor-smk-backend/models"
	"rapor-smk-backend/services"
)

var progressSF singleflight.Group

type ReportController struct {
	reportService *services.ReportService
}

func NewReportController() *ReportController {
	return &ReportController{
		reportService: services.NewReportService(),
	}
}

// verifyRombelReportAccess checks that user is Admin OR Wali Kelas of rombelID OR teaches in that rombel
func verifyRombelReportAccess(db *gorm.DB, c *gin.Context, rombelID string) bool {
	userRole, _ := c.Get("user_role")
	if userRole == string(models.RoleAdmin) {
		return true
	}
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "Sesi tidak valid"})
		return false
	}

	// 1. Is user wali kelas of this rombel?
	var rombelCount int64
	db.Model(&models.Rombel{}).Where("id = ? AND wali_kelas_id = ?", rombelID, userID).Count(&rombelCount)
	if rombelCount > 0 {
		return true
	}

	// 2. Or is user a teacher assigned to this rombel?
	var assignCount int64
	db.Model(&models.TeachingAssignment{}).Where("rombel_id = ? AND guru_id = ?", rombelID, userID).Count(&assignCount)
	if assignCount > 0 {
		return true
	}

	c.JSON(http.StatusForbidden, gin.H{
		"status":  "error",
		"message": "Akses ditolak: Anda bukan Wali Kelas atau Guru yang mengajar di rombel ini",
	})
	return false
}

// verifyStudentReportAccess checks that user is Admin OR Wali Kelas of student's rombel OR teaches student's rombel
func verifyStudentReportAccess(db *gorm.DB, c *gin.Context, studentID string) bool {
	userRole, _ := c.Get("user_role")
	if userRole == string(models.RoleAdmin) {
		return true
	}
	if _, exists := c.Get("user_id"); !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "Sesi tidak valid"})
		return false
	}

	var student models.Student
	if err := db.Select("id, rombel_id").Where("id = ?", studentID).First(&student).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Data siswa tidak ditemukan"})
		return false
	}

	return verifyRombelReportAccess(db, c, student.RombelID)
}

// GetStudentReportPreview returns JSON payload of the entire student report
func (ctrl *ReportController) GetStudentReportPreview(c *gin.Context) {
	studentID := c.Param("student_id")
	semesterID := c.Query("semester_id")
	db := config.DB

	if !verifyStudentReportAccess(db, c, studentID) {
		return
	}

	data, err := ctrl.reportService.GetStudentReportData(db, studentID, semesterID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"report": data,
	})
}

// GetStudentReportHTML returns the compiled print-ready HTML for iframe or preview
func (ctrl *ReportController) GetStudentReportHTML(c *gin.Context) {
	studentID := c.Param("student_id")
	semesterID := c.Query("semester_id")
	db := config.DB

	if !verifyStudentReportAccess(db, c, studentID) {
		return
	}

	data, err := ctrl.reportService.GetStudentReportData(db, studentID, semesterID)
	if err != nil {
		c.String(http.StatusBadRequest, "Error: %s", err.Error())
		return
	}

	htmlContent, err := ctrl.reportService.GenerateReportHTML(data)
	if err != nil {
		c.String(http.StatusInternalServerError, "Gagal membuat template HTML: %s", err.Error())
		return
	}

	c.Header("Content-Type", "text/html; charset=utf-8")
	c.String(http.StatusOK, htmlContent)
}

// GetStudentReportPDF generates and streams PDF using headless Chrome
func (ctrl *ReportController) GetStudentReportPDF(c *gin.Context) {
	studentID := c.Param("student_id")
	semesterID := c.Query("semester_id")
	db := config.DB

	if !verifyStudentReportAccess(db, c, studentID) {
		return
	}

	data, err := ctrl.reportService.GetStudentReportData(db, studentID, semesterID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": err.Error(),
		})
		return
	}

	htmlContent, err := ctrl.reportService.GenerateReportHTML(data)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Gagal generate HTML template: " + err.Error(),
		})
		return
	}

	pdfBytes, err := ctrl.reportService.GeneratePDF(htmlContent)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Gagal generate PDF: " + err.Error(),
		})
		return
	}

	fileName := fmt.Sprintf("Rapor_Mid_%s_%s.pdf", data.Student.Nisn, data.Student.Name)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", fileName))
	c.Header("Content-Length", fmt.Sprintf("%d", len(pdfBytes)))
	c.Data(http.StatusOK, "application/pdf", pdfBytes)
}

// GetRombelReportZip downloads all student PDFs in a rombel as a streaming ZIP archive
// Streams directly to c.Writer to minimize RAM usage to only ~3MB instead of retaining all PDFs in memory.
func (ctrl *ReportController) GetRombelReportZip(c *gin.Context) {
	rombelID := c.Param("rombel_id")
	semesterID := c.Query("semester_id")
	db := config.DB

	if !verifyRombelReportAccess(db, c, rombelID) {
		return
	}

	var rombel models.Rombel
	if err := db.Select("id, name").Where("id = ?", rombelID).First(&rombel).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Rombongan belajar tidak ditemukan"})
		return
	}

	zipFilename := fmt.Sprintf("Rapor_Mid_%s.zip", rombel.Name)
	c.Header("Content-Type", "application/zip")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", zipFilename))
	c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
	c.Header("Pragma", "no-cache")
	c.Header("Expires", "0")

	_, err := ctrl.reportService.StreamRombelZip(db, rombelID, semesterID, c.Writer)
	if err != nil {
		_ = c.Error(err)
		return
	}
}

// GetGradeProgress returns real-time completion tracking per subject & rombel
func (ctrl *ReportController) GetGradeProgress(c *gin.Context) {
	semesterID := c.Query("semester_id")
	db := config.DB

	cacheKey := fmt.Sprintf("dashboard:grade-progress:sem:%s", semesterID)
	if config.RDB != nil {
		if raw, err := config.RDB.Get(config.RedisCtx, cacheKey).Result(); err == nil {
			var cachedProgress []services.GradeProgressItem
			if json.Unmarshal([]byte(raw), &cachedProgress) == nil {
				c.JSON(http.StatusOK, gin.H{
					"status":   "success",
					"progress": cachedProgress,
					"cached":   true,
				})
				return
			}
		}
	}

	v, err, _ := progressSF.Do(cacheKey, func() (interface{}, error) {
		p, err := ctrl.reportService.GetGradeProgress(db, semesterID)
		if err != nil {
			return nil, err
		}
		if config.RDB != nil {
			if data, err := json.Marshal(p); err == nil {
				_ = config.RDB.Set(config.RedisCtx, cacheKey, string(data), 2*time.Minute).Err()
			}
		}
		return p, nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Gagal memuat progres penilaian: " + err.Error(),
		})
		return
	}

	progress, _ := v.([]services.GradeProgressItem)

	c.JSON(http.StatusOK, gin.H{
		"status":   "success",
		"progress": progress,
	})
}
