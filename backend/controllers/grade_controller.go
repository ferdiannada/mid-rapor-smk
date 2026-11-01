package controllers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"rapor-smk-backend/config"
	"rapor-smk-backend/models"
	"rapor-smk-backend/services"
)

type GradeController struct {
	gradeService *services.GradeService
}

func NewGradeController() *GradeController {
	return &GradeController{
		gradeService: services.NewGradeService(),
	}
}

// GetActiveSemesterHelper retrieves active semester or specified semester ID
func GetActiveSemesterHelper(db *gorm.DB, reqSemID string) (*models.Semester, error) {
	var sem models.Semester
	if reqSemID != "" {
		if err := db.Where("id = ?", reqSemID).First(&sem).Error; err != nil {
			return nil, err
		}
		return &sem, nil
	}

	if err := db.Where("is_active = true").First(&sem).Error; err != nil {
		return nil, err
	}
	return &sem, nil
}

// GetGradesByRombelAndSubject returns student list with TP scores and final grades
func (ctrl *GradeController) GetGradesByRombelAndSubject(c *gin.Context) {
	rombelID := c.Param("rombel_id")
	subjectID := c.Param("subject_id")
	semesterID := c.Query("semester_id")
	db := config.DB

	sem, err := GetActiveSemesterHelper(db, semesterID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Semester aktif tidak ditemukan",
		})
		return
	}

	// Access Control: Admin OR assigned teacher for (guru, subject, rombel) OR wali kelas of rombel
	userRole, _ := c.Get("user_role")
	if userRole != string(models.RoleAdmin) {
		userID, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "Sesi tidak valid"})
			return
		}
		var isAssigned int64
		db.Model(&models.TeachingAssignment{}).Where("guru_id = ? AND subject_id = ? AND rombel_id = ?", userID, subjectID, rombelID).Count(&isAssigned)
		if isAssigned == 0 {
			var isWali int64
			db.Model(&models.Rombel{}).Where("id = ? AND wali_kelas_id = ?", rombelID, userID).Count(&isWali)
			if isWali == 0 {
				c.JSON(http.StatusForbidden, gin.H{
					"status":  "error",
					"message": "Akses ditolak: Anda tidak memiliki hak akses melihat nilai kelas/mapel ini",
				})
				return
			}
		}
	}

	// 1. Get Subject details
	var subject models.Subject
	if err := db.Where("id = ?", subjectID).First(&subject).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"status":  "error",
			"message": "Mata pelajaran tidak ditemukan",
		})
		return
	}

	// 2. Get Rombel details
	var rombel models.Rombel
	if err := db.Preload("WaliKelas").Where("id = ?", rombelID).First(&rombel).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"status":  "error",
			"message": "Rombel tidak ditemukan",
		})
		return
	}

	// 3. Get Learning Objectives (TP) for this subject & assigned teacher
	var tps []models.LearningObjective
	var assignedGuruID string

	if userRole == string(models.RoleGuru) {
		if uid, exists := c.Get("user_id"); exists && uid != nil {
			if uidStr, ok := uid.(string); ok && uidStr != "" {
				assignedGuruID = uidStr
			}
		}
	}

	if assignedGuruID == "" {
		var assignment models.TeachingAssignment
		if err := db.Where("rombel_id = ? AND subject_id = ? AND (semester_id = ? OR semester_id IS NULL OR semester_id = '')",
			rombelID, subjectID, sem.ID).First(&assignment).Error; err == nil {
			assignedGuruID = assignment.GuruID
		}
	}

	if assignedGuruID != "" {
		db.Where("subject_id = ? AND guru_id = ?", subjectID, assignedGuruID).
			Order("urutan ASC, kode_tp ASC").
			Find(&tps)
	}

	// Fallback to legacy/global TPs if teacher hasn't created their own TPs yet
	if len(tps) == 0 {
		db.Where("subject_id = ? AND (guru_id IS NULL OR guru_id = '')", subjectID).
			Order("urutan ASC, kode_tp ASC").
			Find(&tps)
	}

	// 4. Get Students in Rombel
	var students []models.Student
	if err := db.Where("rombel_id = ?", rombelID).Order("name ASC").Find(&students).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Gagal mengambil data siswa",
		})
		return
	}

	// 5. Get existing Grades for this rombel + subject + semester
	var grades []models.Grade
	db.Preload("GradeDetails").
		Where("rombel_id = ? AND subject_id = ? AND semester_id = ?", rombelID, subjectID, sem.ID).
		Find(&grades)

	gradeMap := make(map[string]models.Grade)
	for _, g := range grades {
		gradeMap[g.StudentID] = g
	}

	type TPScoreResponse struct {
		LearningObjectiveID string  `json:"learning_objective_id"`
		KodeTP              string  `json:"kode_tp"`
		Nilai               float64 `json:"nilai"`
	}

	type StudentGradeResponse struct {
		StudentID        string            `json:"student_id"`
		StudentName      string            `json:"student_name"`
		NISN             string            `json:"nisn"`
		NIS              string            `json:"nis"`
		GradeID          string            `json:"grade_id,omitempty"`
		NilaiAkhir       float64           `json:"nilai_akhir"`
		DeskripsiCapaian string            `json:"deskripsi_capaian"`
		TPScores         []TPScoreResponse `json:"tp_scores"`
	}

	var result []StudentGradeResponse
	for _, st := range students {
		item := StudentGradeResponse{
			StudentID:   st.ID,
			StudentName: st.Name,
			NISN:        st.Nisn,
			NIS:         st.Nis,
			TPScores:    make([]TPScoreResponse, 0),
		}

		if g, exists := gradeMap[st.ID]; exists {
			item.GradeID = g.ID
			item.NilaiAkhir = g.NilaiAkhir
			item.DeskripsiCapaian = g.DeskripsiCapaian

			detailMap := make(map[string]float64)
			for _, d := range g.GradeDetails {
				detailMap[d.LearningObjectiveID] = d.Nilai
			}

			for _, tp := range tps {
				score := detailMap[tp.ID]
				item.TPScores = append(item.TPScores, TPScoreResponse{
					LearningObjectiveID: tp.ID,
					KodeTP:              tp.KodeTP,
					Nilai:               score,
				})
			}
		} else {
			for _, tp := range tps {
				item.TPScores = append(item.TPScores, TPScoreResponse{
					LearningObjectiveID: tp.ID,
					KodeTP:              tp.KodeTP,
					Nilai:               0,
				})
			}
		}

		result = append(result, item)
	}

	c.JSON(http.StatusOK, gin.H{
		"status":              "success",
		"semester":            sem,
		"rombel":              rombel,
		"subject":             subject,
		"learning_objectives": tps,
		"students":            result,
	})
}

type InputTPScore struct {
	LearningObjectiveID string  `json:"learning_objective_id" binding:"required"`
	Nilai               float64 `json:"nilai"`
}

type InputStudentGrade struct {
	StudentID        string         `json:"student_id" binding:"required"`
	TPScores         []InputTPScore `json:"tp_scores"`
	NilaiAkhir       *float64       `json:"nilai_akhir"`
	DeskripsiCapaian string         `json:"deskripsi_capaian"`
}

type BatchSaveGradesInput struct {
	RombelID   string              `json:"rombel_id" binding:"required"`
	SubjectID  string              `json:"subject_id" binding:"required"`
	SemesterID string              `json:"semester_id"`
	Grades     []InputStudentGrade `json:"grades" binding:"required"`
}

// BatchSaveGrades saves or updates grades and TP details in a transaction
func (ctrl *GradeController) BatchSaveGrades(c *gin.Context) {
	var input BatchSaveGradesInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Data payload input nilai tidak valid: " + err.Error(),
		})
		return
	}

	db := config.DB
	sem, err := GetActiveSemesterHelper(db, input.SemesterID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Semester aktif tidak ditemukan",
		})
		return
	}

	// Current user
	var currentUserID *string
	if u, exists := c.Get("user_id"); exists {
		uid := u.(string)
		currentUserID = &uid
	}

	// Security: Penginputan nilai hanya boleh dilakukan oleh guru pengampu (bukan admin)
	userRole, _ := c.Get("user_role")
	if userRole == string(models.RoleAdmin) {
		c.JSON(http.StatusForbidden, gin.H{
			"status":  "error",
			"message": "Akses ditolak: Penginputan nilai hanya dapat dilakukan oleh guru pengampu mata pelajaran",
		})
		return
	}

	if currentUserID == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "Sesi tidak valid"})
		return
	}
	var assignment models.TeachingAssignment
	if err := db.Where("guru_id = ? AND subject_id = ? AND rombel_id = ?", *currentUserID, input.SubjectID, input.RombelID).First(&assignment).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{
			"status":  "error",
			"message": "Akses ditolak: Anda tidak ditugaskan mengampu mata pelajaran ini di kelas yang dipilih",
		})
		return
	}

	// Load TPs for description generation scoped to this teacher
	var tps []models.LearningObjective
	if err := db.Where("subject_id = ? AND guru_id = ?", input.SubjectID, assignment.GuruID).
		Order("urutan ASC, kode_tp ASC").Find(&tps).Error; err != nil || len(tps) == 0 {
		// Fallback to legacy/global TPs if teacher hasn't created their own TPs yet
		db.Where("subject_id = ? AND (guru_id IS NULL OR guru_id = '')", input.SubjectID).
			Order("urutan ASC, kode_tp ASC").Find(&tps)
	}
	tpMap := make(map[string]models.LearningObjective, len(tps))
	for _, tp := range tps {
		tpMap[tp.ID] = tp
	}

	// Load student names if needed
	var students []models.Student
	db.Where("rombel_id = ?", input.RombelID).Find(&students)
	studentMap := make(map[string]string)
	for _, s := range students {
		studentMap[s.ID] = s.Name
	}

	// Mulai transaksi database lebih awal untuk mengunci proses dan memastikan konsistensi ID
	tx := db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Gunakan PostgreSQL transaction-level advisory lock untuk kombinasi (rombel, mapel, semester)
	// guna mencegah race condition antar request paralel saat data nilai pertama kali dibuat
	if tx.Dialector.Name() == "postgres" {
		lockKey := fmt.Sprintf("grades:%s:%s:%s", input.RombelID, input.SubjectID, sem.ID)
		if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", lockKey).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal memperoleh kunci transaksi nilai: " + err.Error()})
			return
		}
	}

	// Ambil data nilai yang sudah ada di dalam transaksi dengan pessimistic lock (FOR UPDATE)
	var existingGrades []models.Grade
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("rombel_id = ? AND subject_id = ? AND semester_id = ?", input.RombelID, input.SubjectID, sem.ID).
		Find(&existingGrades).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal membaca data nilai yang ada: " + err.Error()})
		return
	}

	existingGradeMap := make(map[string]models.Grade, len(existingGrades))
	for _, eg := range existingGrades {
		existingGradeMap[eg.StudentID] = eg
	}

	var gradesToSave []models.Grade
	var allDetailsToInsert []models.GradeDetail
	var gradeIDsToDeleteDetails []string
	now := time.Now()

	for _, sg := range input.Grades {
		gradeID := uuid.New().String()
		if eg, exists := existingGradeMap[sg.StudentID]; exists {
			gradeID = eg.ID
		} else {
			// Catat ke map agar data duplikat dalam batch input yang sama memakai ID yang sama
			existingGradeMap[sg.StudentID] = models.Grade{ID: gradeID}
		}

		// Convert TP scores to GradeDetails
		var details []models.GradeDetail
		if len(sg.TPScores) > 0 {
			for _, tp := range sg.TPScores {
				details = append(details, models.GradeDetail{
					LearningObjectiveID: tp.LearningObjectiveID,
					Nilai:               tp.Nilai,
				})
			}
		} else if len(tps) > 0 {
			for _, tp := range tps {
				details = append(details, models.GradeDetail{
					LearningObjectiveID: tp.ID,
					Nilai:               0,
				})
			}
		}

		// Auto-calculate final score if not provided
		var finalScore float64
		if sg.NilaiAkhir != nil && *sg.NilaiAkhir > 0 {
			finalScore = *sg.NilaiAkhir
		} else {
			finalScore = ctrl.gradeService.CalculateNilaiAkhir(details)
		}

		// Auto-generate description if empty
		deskripsi := sg.DeskripsiCapaian
		if deskripsi == "" {
			deskripsi = ctrl.gradeService.GenerateDeskripsiCapaian(
				studentMap[sg.StudentID],
				details,
				tpMap,
			)
		}

		grade := models.Grade{
			ID:               gradeID,
			StudentID:        sg.StudentID,
			SubjectID:        input.SubjectID,
			RombelID:         input.RombelID,
			SemesterID:       sem.ID,
			NilaiAkhir:       finalScore,
			DeskripsiCapaian: deskripsi,
			InputBy:          currentUserID,
			CreatedAt:        now,
			UpdatedAt:        now,
		}
		gradesToSave = append(gradesToSave, grade)
		gradeIDsToDeleteDetails = append(gradeIDsToDeleteDetails, gradeID)

		for _, d := range details {
			if d.Nilai >= 0 {
				allDetailsToInsert = append(allDetailsToInsert, models.GradeDetail{
					ID:                  uuid.New().String(),
					GradeID:             gradeID,
					LearningObjectiveID: d.LearningObjectiveID,
					Nilai:               d.Nilai,
					CreatedAt:           now,
					UpdatedAt:           now,
				})
			}
		}
	}

	// 1. Atomic Upsert Grades (prevents race condition & eliminates N queries)
	if len(gradesToSave) > 0 {
		err := tx.Clauses(clause.OnConflict{
			Columns: []clause.Column{
				{Name: "student_id"},
				{Name: "subject_id"},
				{Name: "semester_id"},
			},
			DoUpdates: clause.AssignmentColumns([]string{
				"nilai_akhir", "deskripsi_capaian", "input_by", "updated_at",
			}),
		}).CreateInBatches(gradesToSave, 100).Error
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal menyimpan batch nilai: " + err.Error()})
			return
		}
	}

	// 2. Batch delete old grade details in 1 query
	if len(gradeIDsToDeleteDetails) > 0 {
		if err := tx.Where("grade_id IN ?", gradeIDsToDeleteDetails).Delete(&models.GradeDetail{}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal membersihkan rincian nilai lama: " + err.Error()})
			return
		}
	}

	// 3. Batch insert new grade details in 1 query
	if len(allDetailsToInsert) > 0 {
		if err := tx.CreateInBatches(allDetailsToInsert, 200).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal menyimpan batch rincian TP: " + err.Error()})
			return
		}
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Gagal commit transaksi nilai: " + err.Error(),
		})
		return
	}

	// Invalidate Redis dashboard and progress caches
	if config.RDB != nil {
		_ = config.RDB.Del(config.RedisCtx, "dashboard:stats").Err()
		_ = config.RDB.Del(config.RedisCtx, fmt.Sprintf("dashboard:grade-progress:sem:%s", sem.ID)).Err()
		_ = config.RDB.Del(config.RedisCtx, "dashboard:grade-progress:sem:").Err()
	}

	c.JSON(http.StatusOK, gin.H{
		"status":      "success",
		"message":     "Berhasil menyimpan nilai siswa",
		"saved_count": len(gradesToSave),
	})
}

type GenerateDescriptionInput struct {
	SubjectID string              `json:"subject_id" binding:"required"`
	GuruID    string              `json:"guru_id"`
	Students  []InputStudentGrade `json:"students" binding:"required"`
}

// GenerateAutoDescriptions generates narrative descriptions on the fly for UI preview
func (ctrl *GradeController) GenerateAutoDescriptions(c *gin.Context) {
	var input GenerateDescriptionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Data payload tidak valid",
		})
		return
	}

	db := config.DB
	var tps []models.LearningObjective

	userRole, _ := c.Get("user_role")
	userID, _ := c.Get("user_id")

	var targetGuruID string
	if userRole == string(models.RoleGuru) && userID != nil {
		if uid, ok := userID.(string); ok && uid != "" {
			targetGuruID = uid
		}
	} else if input.GuruID != "" {
		targetGuruID = input.GuruID
	}

	if targetGuruID != "" {
		db.Where("subject_id = ? AND guru_id = ?", input.SubjectID, targetGuruID).
			Order("urutan ASC, kode_tp ASC").Find(&tps)
	}

	if len(tps) == 0 {
		db.Where("subject_id = ? AND (guru_id IS NULL OR guru_id = '')", input.SubjectID).
			Order("urutan ASC, kode_tp ASC").Find(&tps)
	}

	tpMap := make(map[string]models.LearningObjective, len(tps))
	for _, tp := range tps {
		tpMap[tp.ID] = tp
	}

	type GeneratedResult struct {
		StudentID        string  `json:"student_id"`
		NilaiAkhir       float64 `json:"nilai_akhir"`
		DeskripsiCapaian string  `json:"deskripsi_capaian"`
	}

	var results []GeneratedResult
	for _, sg := range input.Students {
		var details []models.GradeDetail
		if len(sg.TPScores) > 0 {
			for _, tp := range sg.TPScores {
				details = append(details, models.GradeDetail{
					LearningObjectiveID: tp.LearningObjectiveID,
					Nilai:               tp.Nilai,
				})
			}
		} else if len(tps) > 0 {
			for _, tp := range tps {
				details = append(details, models.GradeDetail{
					LearningObjectiveID: tp.ID,
					Nilai:               0,
				})
			}
		}

		finalScore := 0.0
		if sg.NilaiAkhir != nil && *sg.NilaiAkhir > 0 {
			finalScore = *sg.NilaiAkhir
		} else {
			finalScore = ctrl.gradeService.CalculateNilaiAkhir(details)
		}
		desc := ctrl.gradeService.GenerateDeskripsiCapaian("", details, tpMap)

		results = append(results, GeneratedResult{
			StudentID:        sg.StudentID,
			NilaiAkhir:       finalScore,
			DeskripsiCapaian: desc,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"results": results,
	})
}
