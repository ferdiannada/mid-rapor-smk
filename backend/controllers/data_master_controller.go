package controllers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"rapor-smk-backend/config"
	"rapor-smk-backend/models"
)

type DataMasterController struct{}

func NewDataMasterController() *DataMasterController {
	return &DataMasterController{}
}

func (ctrl *DataMasterController) GetRombels(c *gin.Context) {
	// Try Redis cache first
	if config.RDB != nil {
		if cached, err := config.RDB.Get(config.RedisCtx, "master:rombels").Result(); err == nil {
			var rombels []models.Rombel
			if json.Unmarshal([]byte(cached), &rombels) == nil {
				c.JSON(http.StatusOK, gin.H{
					"status":  "success",
					"rombels": rombels,
					"cached":  true,
				})
				return
			}
		}
	}

	db := config.DB
	var rombels []models.Rombel
	if err := db.Preload("WaliKelas").Order("tingkat ASC, name ASC").Find(&rombels).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Gagal mengambil data rombel",
		})
		return
	}

	// Compute student count per rombel via bulk GROUP BY (eliminates N+1 query)
	type RombelCount struct {
		RombelID string `gorm:"column:rombel_id"`
		Count    int64  `gorm:"column:count"`
	}
	var counts []RombelCount
	db.Model(&models.Student{}).
		Select("rombel_id, count(*) as count").
		Group("rombel_id").
		Scan(&counts)

	countMap := make(map[string]int64, len(counts))
	for _, c := range counts {
		countMap[c.RombelID] = c.Count
	}

	for i := range rombels {
		rombels[i].StudentCount = countMap[rombels[i].ID]
	}

	// Cache in Redis for 10 minutes
	if config.RDB != nil {
		if data, err := json.Marshal(rombels); err == nil {
			_ = config.RDB.Set(config.RedisCtx, "master:rombels", string(data), 10*time.Minute).Err()
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"rombels": rombels,
	})
}

func (ctrl *DataMasterController) GetRombelStudents(c *gin.Context) {
	rombelID := c.Param("id")
	db := config.DB

	var students []models.Student
	query := db.Where("rombel_id = ?", rombelID)
	if c.Query("include_inactive") != "true" {
		query = query.Where("is_active = ?", true)
	}
	if err := query.Order("name ASC").Find(&students).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Gagal mengambil data peserta didik",
		})
		return
	}

	var rombel models.Rombel
	_ = db.Preload("WaliKelas").First(&rombel, "id = ?", rombelID)

	c.JSON(http.StatusOK, gin.H{
		"status":   "success",
		"rombel":   rombel,
		"students": students,
		"count":    len(students),
	})
}

type SubjectWithTPCount struct {
	models.Subject
	LearningObjectiveCount int64 `json:"learning_objective_count"`
}

func (ctrl *DataMasterController) GetSubjects(c *gin.Context) {
	db := config.DB
	var subjects []models.Subject
	if err := db.Order("kelompok ASC, urutan ASC, nama ASC").Find(&subjects).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Gagal mengambil data mata pelajaran",
		})
		return
	}

	// Compute learning objectives count per subject via bulk GROUP BY (eliminates N+1 query)
	type SubjectTPCount struct {
		SubjectID string `gorm:"column:subject_id"`
		Count     int64  `gorm:"column:count"`
	}
	var tpCounts []SubjectTPCount
	tpQuery := db.Model(&models.LearningObjective{}).
		Select("subject_id, count(*) as count")

	userRole, _ := c.Get("user_role")
	userID, _ := c.Get("user_id")
	if userRole == string(models.RoleGuru) && userID != nil {
		tpQuery = tpQuery.Where("guru_id = ?", userID)
	}

	tpQuery.Group("subject_id").Scan(&tpCounts)

	tpCountMap := make(map[string]int64, len(tpCounts))
	for _, tc := range tpCounts {
		tpCountMap[tc.SubjectID] = tc.Count
	}

	result := make([]SubjectWithTPCount, len(subjects))
	for i := range subjects {
		result[i].Subject = subjects[i]
		result[i].LearningObjectiveCount = tpCountMap[subjects[i].ID]
	}

	c.JSON(http.StatusOK, gin.H{
		"status":   "success",
		"subjects": result,
	})
}

func (ctrl *DataMasterController) GetTeachingAssignments(c *gin.Context) {
	db := config.DB
	var assignments []models.TeachingAssignment
	if err := db.Preload("Guru").Preload("Subject").Preload("Rombel").Order("created_at DESC").Find(&assignments).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Gagal mengambil data penugasan mengajar",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":      "success",
		"assignments": assignments,
	})
}

func (ctrl *DataMasterController) GetMyTeachingAssignments(c *gin.Context) {
	userID, _ := c.Get("user_id")
	userIDStr, ok := userID.(string)
	if !ok || userIDStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "Sesi tidak valid"})
		return
	}

	db := config.DB
	var assignments []models.TeachingAssignment
	if err := db.Where("guru_id = ?", userIDStr).Preload("Subject").Preload("Rombel").Order("created_at DESC").Find(&assignments).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Gagal mengambil data penugasan mengajar Anda",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":      "success",
		"assignments": assignments,
	})
}
