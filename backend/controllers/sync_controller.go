package controllers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"rapor-smk-backend/services"
)

type SyncController struct{}

func NewSyncController() *SyncController {
	return &SyncController{}
}

func (ctrl *SyncController) SyncDapodik(c *gin.Context) {
	opts := services.SyncOptions{
		SyncGtk:                  true,
		SyncRombel:               true,
		SyncSiswa:                true,
		SyncPembelajaran:         true,
		DryRun:                   false,
		PreserveManualOverrides: true,
	}
	_ = c.ShouldBindJSON(&opts)

	userID, _ := c.Get("user_id")
	userIDStr, _ := userID.(string)

	dapodikSvc := services.NewDapodikService()
	summary, err := dapodikSvc.SyncDataWithOptions(opts, userIDStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, summary)
}
