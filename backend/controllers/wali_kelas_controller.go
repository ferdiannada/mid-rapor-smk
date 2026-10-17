package controllers

import (
	"math"
	"net/http"
	"sort"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"rapor-smk-backend/config"
	"rapor-smk-backend/models"
)

type WaliKelasController struct{}

func NewWaliKelasController() *WaliKelasController {
	return &WaliKelasController{}
}

// verifyWaliKelasOrAdmin checks that the current user is Admin OR the Wali Kelas of the target rombel
func verifyWaliKelasOrAdmin(db *gorm.DB, c *gin.Context, rombelID string) bool {
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
	db.Model(&models.Rombel{}).Where("id = ? AND wali_kelas_id = ?", rombelID, userID).Count(&count)
	if count == 0 {
		c.JSON(http.StatusForbidden, gin.H{
			"status":  "error",
			"message": "Akses ditolak: Anda bukan wali kelas dari rombongan belajar ini",
		})
		return false
	}
	return true
}

// verifyWaliKelasOnly checks that the current user is strictly the Wali Kelas of the target rombel (forbids admin)
func verifyWaliKelasOnly(db *gorm.DB, c *gin.Context, rombelID string) bool {
	userRole, _ := c.Get("user_role")
	if userRole == string(models.RoleAdmin) {
		c.JSON(http.StatusForbidden, gin.H{
			"status":  "error",
			"message": "Akses ditolak: Pengelolaan presensi dan catatan kelas hanya dapat dilakukan oleh Wali Kelas",
		})
		return false
	}
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "Sesi tidak valid"})
		return false
	}
	var count int64
	db.Model(&models.Rombel{}).Where("id = ? AND wali_kelas_id = ?", rombelID, userID).Count(&count)
	if count == 0 {
		c.JSON(http.StatusForbidden, gin.H{
			"status":  "error",
			"message": "Akses ditolak: Anda bukan wali kelas dari rombongan belajar ini",
		})
		return false
	}
	return true
}

// -------------------------------------------------------------
// 1. REKAP NILAI SISWA (Matrix Siswa x Mapel)
// -------------------------------------------------------------

type SubjectRecapItem struct {
	ID        string  `json:"id"`
	Nama      string  `json:"nama"`
	Kelompok  string  `json:"kelompok"`
	GuruName  string  `json:"guru_name"`
	RataKelas float64 `json:"rata_kelas"`
}

type StudentSubjectGrade struct {
	NilaiAkhir       float64 `json:"nilai_akhir"`
	DeskripsiCapaian string  `json:"deskripsi_capaian"`
}

type StudentRecapRow struct {
	StudentID   string                         `json:"student_id"`
	StudentName string                         `json:"student_name"`
	NISN        string                         `json:"nisn"`
	NIS         string                         `json:"nis"`
	Grades      map[string]StudentSubjectGrade `json:"grades"` // subject_id -> grade
	RataRata    float64                        `json:"rata_rata"`
	Peringkat   int                            `json:"peringkat"`
}

func (ctrl *WaliKelasController) GetRecap(c *gin.Context) {
	rombelID := c.Param("rombel_id")
	semesterID := c.Query("semester_id")
	db := config.DB

	if !verifyWaliKelasOrAdmin(db, c, rombelID) {
		return
	}

	sem, err := GetActiveSemesterHelper(db, semesterID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Semester aktif tidak ditemukan",
		})
		return
	}

	// 1. Get Rombel
	var rombel models.Rombel
	if err := db.Preload("WaliKelas").Where("id = ?", rombelID).First(&rombel).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"status":  "error",
			"message": "Rombel tidak ditemukan",
		})
		return
	}

	// 2. Get Students
	var students []models.Student
	if err := db.Where("rombel_id = ?", rombelID).Order("name ASC").Find(&students).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Gagal mengambil data siswa",
		})
		return
	}

	// 3. Get Teaching Assignments for this rombel (to discover subjects taught)
	var assignments []models.TeachingAssignment
	db.Preload("Subject").Preload("Guru").
		Where("rombel_id = ?", rombelID).
		Find(&assignments)

	subjectMap := make(map[string]SubjectRecapItem)
	var subjectOrder []string
	for _, a := range assignments {
		if a.Subject != nil {
			if _, exists := subjectMap[a.Subject.ID]; !exists {
				guruName := ""
				if a.Guru != nil {
					guruName = a.Guru.Name
				}
				subjectMap[a.Subject.ID] = SubjectRecapItem{
					ID:       a.Subject.ID,
					Nama:     a.Subject.Nama,
					Kelompok: a.Subject.Kelompok,
					GuruName: guruName,
				}
				subjectOrder = append(subjectOrder, a.Subject.ID)
			}
		}
	}

	// 4. Get all Grades for this rombel and semester
	var grades []models.Grade
	db.Where("rombel_id = ? AND semester_id = ?", rombelID, sem.ID).Find(&grades)

	studentGradeMap := make(map[string]map[string]StudentSubjectGrade)
	subjectTotalScores := make(map[string]float64)
	subjectScoreCounts := make(map[string]int)

	for _, g := range grades {
		if _, ok := studentGradeMap[g.StudentID]; !ok {
			studentGradeMap[g.StudentID] = make(map[string]StudentSubjectGrade)
		}
		studentGradeMap[g.StudentID][g.SubjectID] = StudentSubjectGrade{
			NilaiAkhir:       g.NilaiAkhir,
			DeskripsiCapaian: g.DeskripsiCapaian,
		}

		if g.NilaiAkhir > 0 {
			subjectTotalScores[g.SubjectID] += g.NilaiAkhir
			subjectScoreCounts[g.SubjectID]++
		}
	}

	// Calculate subject class averages
	var subjects []SubjectRecapItem
	for _, sid := range subjectOrder {
		item := subjectMap[sid]
		if count := subjectScoreCounts[sid]; count > 0 {
			item.RataKelas = math.Round((subjectTotalScores[sid]/float64(count))*100) / 100
		}
		subjects = append(subjects, item)
	}

	// Build rows
	var rows []StudentRecapRow
	for _, st := range students {
		row := StudentRecapRow{
			StudentID:   st.ID,
			StudentName: st.Name,
			NISN:        st.Nisn,
			NIS:         st.Nis,
			Grades:      make(map[string]StudentSubjectGrade),
		}

		var total float64
		var count int
		if sgMap, exists := studentGradeMap[st.ID]; exists {
			row.Grades = sgMap
			for _, sid := range subjectOrder {
				if g, ok := sgMap[sid]; ok && g.NilaiAkhir > 0 {
					total += g.NilaiAkhir
					count++
				}
			}
		}

		if count > 0 {
			row.RataRata = math.Round((total/float64(count))*100) / 100
		}

		rows = append(rows, row)
	}

	// Sort by average descending to compute rank
	type rankedIdx struct {
		idx  int
		avg  float64
		name string
	}
	var rankingList []rankedIdx
	for i, r := range rows {
		rankingList = append(rankingList, rankedIdx{idx: i, avg: r.RataRata, name: r.StudentName})
	}
	sort.Slice(rankingList, func(i, j int) bool {
		if rankingList[i].avg != rankingList[j].avg {
			return rankingList[i].avg > rankingList[j].avg
		}
		return rankingList[i].name < rankingList[j].name
	})

	for rank, item := range rankingList {
		if item.avg > 0 {
			rows[item.idx].Peringkat = rank + 1
		} else {
			rows[item.idx].Peringkat = 0
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status":   "success",
		"semester": sem,
		"rombel":   rombel,
		"subjects": subjects,
		"students": rows,
	})
}

// -------------------------------------------------------------
// 2. KEHADIRAN / PRESENSI
// -------------------------------------------------------------

type AttendanceItemResponse struct {
	StudentID       string `json:"student_id"`
	StudentName     string `json:"student_name"`
	NISN            string `json:"nisn"`
	NIS             string `json:"nis"`
	AttendanceID    string `json:"attendance_id,omitempty"`
	Sakit           int    `json:"sakit"`
	Izin            int    `json:"izin"`
	TanpaKeterangan int    `json:"tanpa_keterangan"`
	Total           int    `json:"total"`
}

func (ctrl *WaliKelasController) GetAttendance(c *gin.Context) {
	rombelID := c.Param("rombel_id")
	semesterID := c.Query("semester_id")
	db := config.DB

	if !verifyWaliKelasOnly(db, c, rombelID) {
		return
	}

	sem, err := GetActiveSemesterHelper(db, semesterID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Semester aktif tidak ditemukan"})
		return
	}

	var students []models.Student
	if err := db.Where("rombel_id = ?", rombelID).Order("name ASC").Find(&students).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal mengambil data siswa"})
		return
	}

	var attendances []models.Attendance
	db.Where("rombel_id = ? AND semester_id = ?", rombelID, sem.ID).Find(&attendances)

	attMap := make(map[string]models.Attendance)
	for _, a := range attendances {
		attMap[a.StudentID] = a
	}

	var result []AttendanceItemResponse
	for _, s := range students {
		item := AttendanceItemResponse{
			StudentID:   s.ID,
			StudentName: s.Name,
			NISN:        s.Nisn,
			NIS:         s.Nis,
		}
		if a, ok := attMap[s.ID]; ok {
			item.AttendanceID = a.ID
			item.Sakit = a.Sakit
			item.Izin = a.Izin
			item.TanpaKeterangan = a.TanpaKeterangan
			item.Total = a.Sakit + a.Izin + a.TanpaKeterangan
		}
		result = append(result, item)
	}

	c.JSON(http.StatusOK, gin.H{
		"status":      "success",
		"semester":    sem,
		"attendances": result,
	})
}

type BatchSaveAttendanceItem struct {
	StudentID       string `json:"student_id" binding:"required"`
	Sakit           int    `json:"sakit"`
	Izin            int    `json:"izin"`
	TanpaKeterangan int    `json:"tanpa_keterangan"`
}

type BatchSaveAttendanceInput struct {
	RombelID    string                    `json:"rombel_id" binding:"required"`
	SemesterID  string                    `json:"semester_id"`
	Attendances []BatchSaveAttendanceItem `json:"attendances" binding:"required"`
}

func (ctrl *WaliKelasController) BatchSaveAttendance(c *gin.Context) {
	var input BatchSaveAttendanceInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Payload presensi tidak valid: " + err.Error()})
		return
	}

	db := config.DB
	sem, err := GetActiveSemesterHelper(db, input.SemesterID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Semester aktif tidak ditemukan"})
		return
	}

	var currentUserID *string
	if u, exists := c.Get("user_id"); exists {
		uid := u.(string)
		currentUserID = &uid
	}

	// Security: Verify user is strictly Wali Kelas of this rombel
	if !verifyWaliKelasOnly(db, c, input.RombelID) {
		return
	}

	var attendancesToSave []models.Attendance
	now := time.Now()
	for _, item := range input.Attendances {
		att := models.Attendance{
			ID:              uuid.New().String(),
			StudentID:       item.StudentID,
			RombelID:        input.RombelID,
			SemesterID:      sem.ID,
			Sakit:           item.Sakit,
			Izin:            item.Izin,
			TanpaKeterangan: item.TanpaKeterangan,
			InputBy:         currentUserID,
			CreatedAt:       now,
			UpdatedAt:       now,
		}
		attendancesToSave = append(attendancesToSave, att)
	}

	tx := db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	if len(attendancesToSave) > 0 {
		err := tx.Clauses(clause.OnConflict{
			Columns: []clause.Column{
				{Name: "student_id"},
				{Name: "semester_id"},
			},
			DoUpdates: clause.AssignmentColumns([]string{
				"sakit", "izin", "tanpa_keterangan", "input_by", "updated_at",
			}),
		}).CreateInBatches(attendancesToSave, 100).Error
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal menyimpan batch presensi: " + err.Error()})
			return
		}
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal commit presensi: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Presensi kehadiran berhasil disimpan"})
}

// -------------------------------------------------------------
// 3. EKSTRAKURIKULER
// -------------------------------------------------------------

func (ctrl *WaliKelasController) GetExtracurriculars(c *gin.Context) {
	rombelID := c.Param("rombel_id")
	semesterID := c.Query("semester_id")
	db := config.DB

	if !verifyWaliKelasOnly(db, c, rombelID) {
		return
	}

	sem, err := GetActiveSemesterHelper(db, semesterID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Semester aktif tidak ditemukan"})
		return
	}

	var items []models.Extracurricular
	db.Preload("Student").
		Where("rombel_id = ? AND semester_id = ?", rombelID, sem.ID).
		Order("created_at ASC").
		Find(&items)

	c.JSON(http.StatusOK, gin.H{
		"status":           "success",
		"semester":         sem,
		"extracurriculars": items,
	})
}

type SaveEkskulInput struct {
	ID         string `json:"id"`
	StudentID  string `json:"student_id" binding:"required"`
	RombelID   string `json:"rombel_id" binding:"required"`
	SemesterID string `json:"semester_id"`
	NamaEkskul string `json:"nama_ekskul" binding:"required"`
	Predikat   string `json:"predikat" binding:"required"`
	Keterangan string `json:"keterangan"`
}

func (ctrl *WaliKelasController) SaveExtracurricular(c *gin.Context) {
	var input SaveEkskulInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Payload ekstrakurikuler tidak valid: " + err.Error()})
		return
	}

	db := config.DB
	sem, err := GetActiveSemesterHelper(db, input.SemesterID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Semester aktif tidak ditemukan"})
		return
	}

	var currentUserID *string
	if u, exists := c.Get("user_id"); exists {
		uid := u.(string)
		currentUserID = &uid
	}

	// Security: Verify user is strictly Wali Kelas of this rombel
	if !verifyWaliKelasOnly(db, c, input.RombelID) {
		return
	}

	if input.ID != "" {
		var item models.Extracurricular
		if err := db.Where("id = ?", input.ID).First(&item).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Data ekstrakurikuler tidak ditemukan"})
			return
		}
		item.NamaEkskul = input.NamaEkskul
		item.Predikat = input.Predikat
		item.Keterangan = input.Keterangan
		item.InputBy = currentUserID
		item.UpdatedAt = time.Now()
		if err := db.Save(&item).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal update ekskul: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Ekstrakurikuler berhasil diperbarui", "extracurricular": item})
		return
	}

	newItem := models.Extracurricular{
		ID:         uuid.New().String(),
		StudentID:  input.StudentID,
		RombelID:   input.RombelID,
		SemesterID: sem.ID,
		NamaEkskul: input.NamaEkskul,
		Predikat:   input.Predikat,
		Keterangan: input.Keterangan,
		InputBy:    currentUserID,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	if err := db.Create(&newItem).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal menambah ekskul: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Ekstrakurikuler berhasil ditambahkan", "extracurricular": newItem})
}

func (ctrl *WaliKelasController) DeleteExtracurricular(c *gin.Context) {
	id := c.Param("id")
	db := config.DB

	var item models.Extracurricular
	if err := db.Where("id = ?", id).First(&item).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Data ekstrakurikuler tidak ditemukan"})
		return
	}

	// Security: Verify user is strictly Wali Kelas of this rombel
	if !verifyWaliKelasOnly(db, c, item.RombelID) {
		return
	}

	if err := db.Delete(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal menghapus ekskul: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Ekstrakurikuler berhasil dihapus"})
}

// -------------------------------------------------------------
// 4. CATATAN WALI KELAS
// -------------------------------------------------------------

type WaliNoteItemResponse struct {
	StudentID   string `json:"student_id"`
	StudentName string `json:"student_name"`
	NISN        string `json:"nisn"`
	NIS         string `json:"nis"`
	NoteID      string `json:"note_id,omitempty"`
	Catatan     string `json:"catatan"`
}

func (ctrl *WaliKelasController) GetWaliNotes(c *gin.Context) {
	rombelID := c.Param("rombel_id")
	semesterID := c.Query("semester_id")
	db := config.DB

	if !verifyWaliKelasOnly(db, c, rombelID) {
		return
	}

	sem, err := GetActiveSemesterHelper(db, semesterID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Semester aktif tidak ditemukan"})
		return
	}

	var students []models.Student
	if err := db.Where("rombel_id = ?", rombelID).Order("name ASC").Find(&students).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal mengambil data siswa"})
		return
	}

	var notes []models.WaliKelasNote
	db.Where("rombel_id = ? AND semester_id = ?", rombelID, sem.ID).Find(&notes)

	noteMap := make(map[string]models.WaliKelasNote)
	for _, n := range notes {
		noteMap[n.StudentID] = n
	}

	var result []WaliNoteItemResponse
	for _, s := range students {
		item := WaliNoteItemResponse{
			StudentID:   s.ID,
			StudentName: s.Name,
			NISN:        s.Nisn,
			NIS:         s.Nis,
		}
		if n, ok := noteMap[s.ID]; ok {
			item.NoteID = n.ID
			item.Catatan = n.Catatan
		}
		result = append(result, item)
	}

	c.JSON(http.StatusOK, gin.H{
		"status":   "success",
		"semester": sem,
		"notes":    result,
	})
}

type BatchSaveWaliNotesItem struct {
	StudentID string `json:"student_id" binding:"required"`
	Catatan   string `json:"catatan"`
}

type BatchSaveWaliNotesInput struct {
	RombelID   string                   `json:"rombel_id" binding:"required"`
	SemesterID string                   `json:"semester_id"`
	Notes      []BatchSaveWaliNotesItem `json:"notes" binding:"required"`
}

func (ctrl *WaliKelasController) BatchSaveWaliNotes(c *gin.Context) {
	var input BatchSaveWaliNotesInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Payload catatan wali kelas tidak valid: " + err.Error()})
		return
	}

	db := config.DB
	sem, err := GetActiveSemesterHelper(db, input.SemesterID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Semester aktif tidak ditemukan"})
		return
	}

	var currentUserID *string
	if u, exists := c.Get("user_id"); exists {
		uid := u.(string)
		currentUserID = &uid
	}

	// Security: Verify user is strictly Wali Kelas of this rombel
	if !verifyWaliKelasOnly(db, c, input.RombelID) {
		return
	}

	var notesToSave []models.WaliKelasNote
	now := time.Now()
	for _, item := range input.Notes {
		note := models.WaliKelasNote{
			ID:         uuid.New().String(),
			StudentID:  item.StudentID,
			RombelID:   input.RombelID,
			SemesterID: sem.ID,
			Catatan:    item.Catatan,
			InputBy:    currentUserID,
			CreatedAt:  now,
			UpdatedAt:  now,
		}
		notesToSave = append(notesToSave, note)
	}

	tx := db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	if len(notesToSave) > 0 {
		err := tx.Clauses(clause.OnConflict{
			Columns: []clause.Column{
				{Name: "student_id"},
				{Name: "semester_id"},
			},
			DoUpdates: clause.AssignmentColumns([]string{
				"catatan", "input_by", "updated_at",
			}),
		}).CreateInBatches(notesToSave, 100).Error
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal menyimpan batch catatan: " + err.Error()})
			return
		}
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal commit catatan wali kelas: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Catatan wali kelas berhasil disimpan"})
}
