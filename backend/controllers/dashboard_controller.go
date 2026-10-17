package controllers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/sync/singleflight"
	"rapor-smk-backend/config"
	"rapor-smk-backend/models"
)

var dashboardSF singleflight.Group

type DashboardController struct{}

func NewDashboardController() *DashboardController {
	return &DashboardController{}
}

func (ctrl *DashboardController) GetStats(c *gin.Context) {
	// Try Redis cache for general stats
	type DashboardStats struct {
		TotalTeachers   int64            `json:"total_teachers"`
		TotalStudents   int64            `json:"total_students"`
		TotalRombels    int64            `json:"total_rombels"`
		TotalSubjects   int64            `json:"total_subjects"`
		ActiveSemester  *models.Semester `json:"active_semester"`
		MyAssignments   int64            `json:"my_assignments"`
		MyStudentReach  int64            `json:"my_student_reach"`
	}

	db := config.DB
	var stats DashboardStats

	// Check Redis cache for overall numbers
	cacheKey := "dashboard:stats"
	cached := false
	if config.RDB != nil {
		if raw, err := config.RDB.Get(config.RedisCtx, cacheKey).Result(); err == nil {
			if json.Unmarshal([]byte(raw), &stats) == nil {
				cached = true
			}
		}
	}

	if !cached {
		v, err, _ := dashboardSF.Do(cacheKey, func() (interface{}, error) {
			var s DashboardStats
			db.Model(&models.User{}).Where("role = ?", models.RoleGuru).Count(&s.TotalTeachers)
			db.Model(&models.Student{}).Count(&s.TotalStudents)
			db.Model(&models.Rombel{}).Count(&s.TotalRombels)
			db.Model(&models.Subject{}).Count(&s.TotalSubjects)

			var activeSem models.Semester
			if err := db.Where("is_active = ?", true).First(&activeSem).Error; err == nil {
				s.ActiveSemester = &activeSem
			}

			if config.RDB != nil {
				if data, err := json.Marshal(s); err == nil {
					_ = config.RDB.Set(config.RedisCtx, cacheKey, string(data), 5*time.Minute).Err()
				}
			}
			return s, nil
		})
		if err == nil && v != nil {
			stats = v.(DashboardStats)
		}
	}

	// User-specific stats
	userID, exists := c.Get("user_id")
	if exists {
		userIDStr, _ := userID.(string)
		var myAssignments []models.TeachingAssignment
		db.Where("guru_id = ?", userIDStr).Find(&myAssignments)
		stats.MyAssignments = int64(len(myAssignments))

		// Student reach (eliminates N+1 query via single IN query)
		rombelIDs := make([]string, 0)
		seen := make(map[string]bool)
		for _, a := range myAssignments {
			if !seen[a.RombelID] {
				seen[a.RombelID] = true
				rombelIDs = append(rombelIDs, a.RombelID)
			}
		}
		var totalReach int64
		if len(rombelIDs) > 0 {
			db.Model(&models.Student{}).Where("rombel_id IN ?", rombelIDs).Count(&totalReach)
		}
		stats.MyStudentReach = totalReach
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"stats":  stats,
	})
}
