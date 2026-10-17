package controllers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"rapor-smk-backend/config"
	"rapor-smk-backend/models"
)

type DapodikConfigController struct {
	cfg *config.Config
}

func NewDapodikConfigController(cfg *config.Config) *DapodikConfigController {
	return &DapodikConfigController{cfg: cfg}
}

func (ctrl *DapodikConfigController) GetConfig(c *gin.Context) {
	var dbCfg models.DapodikConfig
	db := config.DB

	err := db.Where("is_active = ?", true).Order("updated_at DESC").First(&dbCfg).Error
	if err != nil {
		// Fallback from runtime configuration
		dbCfg = models.DapodikConfig{
			Name:           "Koneksi Dapodik Default",
			DapodikHost:    ctrl.cfg.DapodikHost,
			DapodikPort:    ctrl.cfg.DapodikPort,
			DapodikToken:   ctrl.cfg.DapodikToken,
			Npsn:           ctrl.cfg.NPSN,
			TimeoutSeconds: 10,
			IsActive:       true,
		}
	}

	maskedToken := ""
	if len(dbCfg.DapodikToken) > 6 {
		maskedToken = dbCfg.DapodikToken[:2] + "••••••••" + dbCfg.DapodikToken[len(dbCfg.DapodikToken)-2:]
	} else if dbCfg.DapodikToken != "" {
		maskedToken = "••••••••"
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"config": gin.H{
			"id":              dbCfg.ID,
			"name":            dbCfg.Name,
			"dapodik_host":    dbCfg.DapodikHost,
			"dapodik_port":    dbCfg.DapodikPort,
			"masked_token":    maskedToken,
			"has_token":       dbCfg.DapodikToken != "",
			"npsn":           dbCfg.Npsn,
			"timeout_seconds": dbCfg.TimeoutSeconds,
			"is_active":       dbCfg.IsActive,
			"updated_at":      dbCfg.UpdatedAt,
			"updated_by":      dbCfg.UpdatedBy,
		},
	})
}

func (ctrl *DapodikConfigController) GetAllConfigs(c *gin.Context) {
	db := config.DB
	var configs []models.DapodikConfig
	if err := db.Order("is_active DESC, updated_at DESC").Find(&configs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Gagal mengambil daftar konfigurasi Dapodik",
		})
		return
	}

	type ConfigItem struct {
		ID             string    `json:"id"`
		Name           string    `json:"name"`
		DapodikHost    string    `json:"dapodik_host"`
		DapodikPort    int       `json:"dapodik_port"`
		MaskedToken    string    `json:"masked_token"`
		HasToken       bool      `json:"has_token"`
		Npsn           string    `json:"npsn"`
		TimeoutSeconds int       `json:"timeout_seconds"`
		IsActive       bool      `json:"is_active"`
		UpdatedAt      time.Time `json:"updated_at"`
		UpdatedBy      string    `json:"updated_by"`
	}

	items := make([]ConfigItem, 0, len(configs))
	for _, cfg := range configs {
		maskedToken := ""
		if len(cfg.DapodikToken) > 6 {
			maskedToken = cfg.DapodikToken[:2] + "••••••••" + cfg.DapodikToken[len(cfg.DapodikToken)-2:]
		} else if cfg.DapodikToken != "" {
			maskedToken = "••••••••"
		}
		items = append(items, ConfigItem{
			ID:             cfg.ID,
			Name:           cfg.Name,
			DapodikHost:    cfg.DapodikHost,
			DapodikPort:    cfg.DapodikPort,
			MaskedToken:    maskedToken,
			HasToken:       cfg.DapodikToken != "",
			Npsn:           cfg.Npsn,
			TimeoutSeconds: cfg.TimeoutSeconds,
			IsActive:       cfg.IsActive,
			UpdatedAt:      cfg.UpdatedAt,
			UpdatedBy:      cfg.UpdatedBy,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"configs": items,
	})
}

type SaveConfigInput struct {
	Name           string `json:"name"`
	DapodikHost    string `json:"dapodik_host" binding:"required"`
	DapodikPort    int    `json:"dapodik_port" binding:"required"`
	DapodikToken   string `json:"dapodik_token"`
	Npsn           string `json:"npsn" binding:"required"`
	TimeoutSeconds int    `json:"timeout_seconds"`
}

func (ctrl *DapodikConfigController) SaveConfig(c *gin.Context) {
	var input SaveConfigInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Host, Port, dan NPSN wajib diisi dengan benar",
		})
		return
	}

	host := strings.TrimSpace(input.DapodikHost)
	host = strings.TrimPrefix(host, "http://")
	host = strings.TrimPrefix(host, "https://")
	if parts := strings.Split(host, ":"); len(parts) > 0 {
		host = parts[0]
	}

	name := strings.TrimSpace(input.Name)
	if name == "" {
		name = fmt.Sprintf("Koneksi %s:%d", host, input.DapodikPort)
	}

	timeoutSec := input.TimeoutSeconds
	if timeoutSec <= 0 {
		timeoutSec = 10
	}

	token := strings.TrimSpace(input.DapodikToken)
	db := config.DB

	// If token is empty and an active config exists, keep previous token
	if token == "" {
		var existing models.DapodikConfig
		if err := db.Where("is_active = ?", true).First(&existing).Error; err == nil {
			token = existing.DapodikToken
		}
	}

	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Token Web Service Dapodik wajib diisi",
		})
		return
	}

	// Validasi jika token sudah pernah disimpan di database
	var existingToken models.DapodikConfig
	if err := db.Where("dapodik_token = ?", token).First(&existingToken).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": fmt.Sprintf("Token Dapodik ini sudah pernah disimpan pada koneksi '%s' (%s:%d). Silakan gunakan dropdown 'Pilih Koneksi Cepat' untuk mengaktifkan koneksi tersebut, atau gunakan token baru jika ini komputer yang berbeda.", existingToken.Name, existingToken.DapodikHost, existingToken.DapodikPort),
		})
		return
	}

	userID, _ := c.Get("user_id")
	userIDStr, _ := userID.(string)

	// Begin transaction to deactivate old and insert new config
	err := db.Transaction(func(tx *gorm.DB) error {
		// Deactivate current active configs
		if err := tx.Model(&models.DapodikConfig{}).Where("is_active = ?", true).Update("is_active", false).Error; err != nil {
			return err
		}

		newCfg := models.DapodikConfig{
			ID:             uuid.NewString(),
			Name:           name,
			DapodikHost:    host,
			DapodikPort:    input.DapodikPort,
			DapodikToken:   token,
			Npsn:           strings.TrimSpace(input.Npsn),
			TimeoutSeconds: timeoutSec,
			IsActive:       true,
			CreatedAt:      time.Now(),
			UpdatedAt:      time.Now(),
			UpdatedBy:      userIDStr,
		}

		return tx.Create(&newCfg).Error
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": fmt.Sprintf("Gagal menyimpan konfigurasi Dapodik: %v", err),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": fmt.Sprintf("Konfigurasi Dapodik '%s' berhasil disimpan dan diaktifkan!", name),
	})
}

func (ctrl *DapodikConfigController) ActivateConfig(c *gin.Context) {
	id := c.Param("id")
	db := config.DB

	var target models.DapodikConfig
	if err := db.Where("id = ?", id).First(&target).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"status":  "error",
			"message": "Konfigurasi Dapodik tidak ditemukan",
		})
		return
	}

	if target.IsActive {
		c.JSON(http.StatusOK, gin.H{
			"status":  "success",
			"message": fmt.Sprintf("Koneksi '%s' sudah aktif", target.Name),
			"config":  target,
		})
		return
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		// Nonaktifkan semua koneksi yang sedang aktif
		if err := tx.Model(&models.DapodikConfig{}).Where("is_active = ?", true).Update("is_active", false).Error; err != nil {
			return err
		}

		// Aktifkan koneksi target
		return tx.Model(&models.DapodikConfig{}).Where("id = ?", id).Updates(map[string]interface{}{
			"is_active":  true,
			"updated_at": time.Now(),
		}).Error
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": fmt.Sprintf("Gagal mengaktifkan koneksi: %v", err),
		})
		return
	}

	target.IsActive = true
	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": fmt.Sprintf("Koneksi '%s' (%s:%d) berhasil diaktifkan!", target.Name, target.DapodikHost, target.DapodikPort),
		"config":  target,
	})
}

func (ctrl *DapodikConfigController) DeleteConfig(c *gin.Context) {
	id := c.Param("id")
	db := config.DB

	var target models.DapodikConfig
	if err := db.Where("id = ?", id).First(&target).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"status":  "error",
			"message": "Konfigurasi Dapodik tidak ditemukan",
		})
		return
	}

	if target.IsActive {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Koneksi yang sedang aktif tidak dapat dihapus. Silakan aktifkan koneksi lain terlebih dahulu.",
		})
		return
	}

	if err := db.Delete(&target).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": fmt.Sprintf("Gagal menghapus konfigurasi: %v", err),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": fmt.Sprintf("Koneksi '%s' berhasil dihapus", target.Name),
	})
}

type TestConnectionInput struct {
	DapodikHost    string `json:"dapodik_host"`
	DapodikPort    int    `json:"dapodik_port"`
	DapodikToken   string `json:"dapodik_token"`
	Npsn           string `json:"npsn"`
	TimeoutSeconds int    `json:"timeout_seconds"`
}

func (ctrl *DapodikConfigController) TestConnection(c *gin.Context) {
	var input TestConnectionInput
	_ = c.ShouldBindJSON(&input)

	db := config.DB

	host := strings.TrimSpace(input.DapodikHost)
	port := input.DapodikPort
	token := strings.TrimSpace(input.DapodikToken)
	npsn := strings.TrimSpace(input.Npsn)
	timeoutSec := input.TimeoutSeconds

	// If any parameter is empty, look up from active database config
	if host == "" || port == 0 || token == "" || npsn == "" {
		var activeCfg models.DapodikConfig
		if err := db.Where("is_active = ?", true).First(&activeCfg).Error; err == nil {
			if host == "" {
				host = activeCfg.DapodikHost
			}
			if port == 0 {
				port = activeCfg.DapodikPort
			}
			if token == "" {
				token = activeCfg.DapodikToken
			}
			if npsn == "" {
				npsn = activeCfg.Npsn
			}
			if timeoutSec == 0 {
				timeoutSec = activeCfg.TimeoutSeconds
			}
		} else {
			// Fallback from env
			if host == "" {
				host = ctrl.cfg.DapodikHost
			}
			if port == 0 {
				port = ctrl.cfg.DapodikPort
			}
			if token == "" {
				token = ctrl.cfg.DapodikToken
			}
			if npsn == "" {
				npsn = ctrl.cfg.NPSN
			}
		}
	}

	if timeoutSec <= 0 {
		timeoutSec = 5
	}

	host = strings.TrimPrefix(host, "http://")
	host = strings.TrimPrefix(host, "https://")
	if parts := strings.Split(host, ":"); len(parts) > 0 {
		host = parts[0]
	}

	if host == "" || port <= 0 || token == "" || npsn == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "failed",
			"message": "Host, Port, NPSN, dan Token Web Service wajib diisi untuk melakukan pengujian koneksi.",
		})
		return
	}

	targetURL := fmt.Sprintf("http://%s:%d/WebService/getGtk?npsn=%s", host, port, npsn)
	req, err := http.NewRequest("GET", targetURL, nil)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "failed",
			"message": fmt.Sprintf("Format URL server tidak valid: %v", err),
		})
		return
	}

	req.Header.Set("Authorization", "Bearer "+token)
	client := &http.Client{
		Timeout: time.Duration(timeoutSec) * time.Second,
	}

	start := time.Now()
	resp, err := client.Do(req)
	latency := time.Since(start).Milliseconds()

	serverAddr := fmt.Sprintf("%s:%d", host, port)

	if err != nil {
		reason := "Server Dapodik tidak dapat dijangkau (Connection Timeout)."
		errStr := err.Error()
		if strings.Contains(errStr, "connection refused") {
			reason = "Koneksi ditolak (Connection Refused). Pastikan Web Service Dapodik di komputer/server tujuan sudah diaktifkan pada port tersebut."
		} else if strings.Contains(errStr, "no such host") {
			reason = "Hostname / IP Address tidak ditemukan. Periksa penulisan IP Server."
		}

		c.JSON(http.StatusOK, gin.H{
			"status":     "failed",
			"server":     serverAddr,
			"latency_ms": latency,
			"message":    fmt.Sprintf("Gagal terhubung: %s", reason),
			"error":      errStr,
		})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		c.JSON(http.StatusOK, gin.H{
			"status":     "failed",
			"server":     serverAddr,
			"latency_ms": latency,
			"message":    "Koneksi berhasil tetapi Otorisasi Ditolak (401/403). Secret Token Web Service Dapodik tidak cocok.",
		})
		return
	}

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusOK, gin.H{
			"status":     "failed",
			"server":     serverAddr,
			"latency_ms": latency,
			"message":    fmt.Sprintf("Server Dapodik merespon HTTP status %d %s.", resp.StatusCode, resp.Status),
		})
		return
	}

	bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 1024*1024))
	bodyStr := string(bodyBytes)

	if strings.Contains(bodyStr, "403 Forbidden") || strings.Contains(bodyStr, "Aplikasi tidak terdaftar") || strings.Contains(bodyStr, `"success":false`) {
		errMsg := "Aplikasi tidak terdaftar atau token Web Service Dapodik tidak cocok."
		var errResp struct {
			Message string `json:"message"`
		}
		if idx := strings.Index(bodyStr, "{"); idx != -1 {
			if json.Unmarshal([]byte(bodyStr[idx:]), &errResp) == nil && errResp.Message != "" {
				errMsg = errResp.Message
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":     "failed",
			"server":     serverAddr,
			"latency_ms": latency,
			"message":    fmt.Sprintf("Koneksi ditolak oleh Dapodik: %s", errMsg),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":     "success",
		"server":     serverAddr,
		"latency_ms": latency,
		"message":    fmt.Sprintf("Berhasil terhubung ke Web Service Dapodik! (Latensi: %d ms)", latency),
	})
}
