package controllers

import (
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"rapor-smk-backend/config"
	"rapor-smk-backend/models"
)

type SchoolController struct{}

func NewSchoolController() *SchoolController {
	return &SchoolController{}
}

// GetProfile retrieves the active school identity profile
func (ctrl *SchoolController) GetProfile(c *gin.Context) {
	db := config.DB
	var profile models.SchoolProfile

	if err := db.Order("updated_at DESC").First(&profile).Error; err != nil {
		profile = models.SchoolProfile{
			ID:                "default",
			NamaSekolah:       "SMK NEGERI 1 KOTA",
			NPSN:              "20108921",
			BentukPendidikan:  "SMK",
			StatusSekolah:     "Negeri",
			Alamat:            "Jl. Pendidikan No. 45, Kompleks Edukasi",
			KabupatenKota:     "Jakarta",
			Provinsi:          "DKI Jakarta",
			KopBaris1:         "PEMERINTAH PROVINSI DAERAH KHUSUS IBUKOTA JAKARTA",
			KopBaris2:         "DINAS PENDIDIKAN",
			KepalaSekolahNama: "Drs. H. Mulyadi, M.Pd.",
			KepalaSekolahNIP:  "196805121994031004",
			TitimangsaTempat:  "Jakarta",
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"profile": profile,
	})
}

// UpdateProfile updates or creates the school profile
func (ctrl *SchoolController) UpdateProfile(c *gin.Context) {
	db := config.DB
	var input models.SchoolProfile

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Format data tidak valid: " + err.Error(),
		})
		return
	}

	namaSekolah := strings.TrimSpace(input.NamaSekolah)
	if namaSekolah == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Nama sekolah wajib diisi",
		})
		return
	}

	npsn := strings.TrimSpace(input.NPSN)
	if npsn == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "NPSN wajib diisi",
		})
		return
	}

	currentUserID, _ := c.Get("userID")
	currentUserIDStr, _ := currentUserID.(string)

	var existing models.SchoolProfile
	err := db.Order("updated_at DESC").First(&existing).Error

	if err != nil {
		input.ID = "default"
		input.CreatedAt = time.Now()
		input.UpdatedAt = time.Now()
		input.UpdatedBy = currentUserIDStr
		if err := db.Create(&input).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  "error",
				"message": "Gagal menyimpan identitas sekolah: " + err.Error(),
			})
			return
		}
		existing = input
	} else {
		input.ID = existing.ID
		input.UpdatedAt = time.Now()
		input.UpdatedBy = currentUserIDStr
		if err := db.Model(&existing).Updates(&input).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  "error",
				"message": "Gagal memperbarui identitas sekolah: " + err.Error(),
			})
			return
		}
		// Explicitly update logo fields to allow removing/clearing logos
		_ = db.Model(&existing).Updates(map[string]interface{}{
			"logo_kiri":  input.LogoKiri,
			"logo_kanan": input.LogoKanan,
		}).Error
		_ = db.First(&existing, "id = ?", existing.ID)
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Identitas sekolah berhasil diperbarui",
		"profile": existing,
	})
}

// UploadLogo handles direct image upload and returns a data URL
func (ctrl *SchoolController) UploadLogo(c *gin.Context) {
	fileHeader, err := c.FormFile("logo")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "File logo tidak ditemukan dalam request",
		})
		return
	}

	if fileHeader.Size > 2*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Ukuran file logo maksimal 2 MB",
		})
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Gagal membuka file logo",
		})
		return
	}
	defer file.Close()

	fileBytes, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Gagal membaca isi file logo",
		})
		return
	}

	mimeType := http.DetectContentType(fileBytes)
	allowedMimes := map[string]bool{
		"image/png":               true,
		"image/jpeg":              true,
		"image/jpg":               true,
		"image/webp":              true,
		"image/svg+xml":           true,
		"text/xml; charset=utf-8": true,
	}

	if strings.HasSuffix(strings.ToLower(fileHeader.Filename), ".svg") {
		mimeType = "image/svg+xml"
	} else if !allowedMimes[mimeType] {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": fmt.Sprintf("Format file tidak didukung (%s). Gunakan PNG, JPEG, WEBP, atau SVG.", mimeType),
		})
		return
	}

	base64Encoded := base64.StdEncoding.EncodeToString(fileBytes)
	dataURL := fmt.Sprintf("data:%s;base64,%s", mimeType, base64Encoded)

	c.JSON(http.StatusOK, gin.H{
		"status":   "success",
		"message":  "Logo berhasil diproses",
		"data_url": dataURL,
	})
}
