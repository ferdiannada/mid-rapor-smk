package controllers

import (
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"rapor-smk-backend/config"
	"rapor-smk-backend/models"
)

type AdminMasterController struct{}

func NewAdminMasterController() *AdminMasterController {
	return &AdminMasterController{}
}

// -------------------------------------------------------------
// 1. MANAJEMEN PESERTA DIDIK (SISWA)
// -------------------------------------------------------------

type CreateStudentInput struct {
	Name         string `json:"name" binding:"required"`
	Nisn         string `json:"nisn"`
	Nis          string `json:"nis"`
	RombelID     string `json:"rombel_id" binding:"required"`
	JenisKelamin string `json:"jenis_kelamin"` // L / P
	TempatLahir  string `json:"tempat_lahir"`
	TanggalLahir string `json:"tanggal_lahir"` // YYYY-MM-DD
}

func (ctrl *AdminMasterController) CreateStudent(c *gin.Context) {
	var input CreateStudentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Nama siswa dan Rombel (kelas) wajib diisi",
		})
		return
	}

	db := config.DB

	// Pastikan rombel ada
	var rombel models.Rombel
	if err := db.First(&rombel, "id = ?", input.RombelID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Rombongan belajar tidak ditemukan",
		})
		return
	}

	now := time.Now()
	student := models.Student{
		ID:               uuid.NewString(),
		Name:             strings.TrimSpace(input.Name),
		Nisn:             strings.TrimSpace(input.Nisn),
		Nis:              strings.TrimSpace(input.Nis),
		RombelID:         input.RombelID,
		JenisKelamin:     input.JenisKelamin,
		TempatLahir:      strings.TrimSpace(input.TempatLahir),
		TanggalLahir:     strings.TrimSpace(input.TanggalLahir),
		IsManualOverride: true,
		IsActive:         true,
		CreatedAt:        now,
		UpdatedAt:        now,
	}

	if err := db.Create(&student).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Gagal menambahkan peserta didik: " + err.Error(),
		})
		return
	}

	if config.RDB != nil {
		_ = config.RDB.Del(config.RedisCtx, "master:rombels", "dashboard:stats").Err()
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Peserta didik berhasil ditambahkan secara manual",
		"student": student,
	})
}

type UpdateStudentInput struct {
	Name         string `json:"name"`
	Nisn         string `json:"nisn"`
	Nis          string `json:"nis"`
	JenisKelamin string `json:"jenis_kelamin"`
	TempatLahir  string `json:"tempat_lahir"`
	TanggalLahir string `json:"tanggal_lahir"`
	IsActive     *bool  `json:"is_active"`
}

func (ctrl *AdminMasterController) UpdateStudent(c *gin.Context) {
	studentID := c.Param("id")
	var input UpdateStudentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Format data tidak valid"})
		return
	}

	db := config.DB
	var student models.Student
	if err := db.First(&student, "id = ?", studentID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Peserta didik tidak ditemukan"})
		return
	}

	if strings.TrimSpace(input.Name) != "" {
		student.Name = strings.TrimSpace(input.Name)
	}
	if input.Nisn != "" {
		student.Nisn = strings.TrimSpace(input.Nisn)
	}
	if input.Nis != "" {
		student.Nis = strings.TrimSpace(input.Nis)
	}
	if input.JenisKelamin != "" {
		student.JenisKelamin = input.JenisKelamin
	}
	if input.TempatLahir != "" {
		student.TempatLahir = strings.TrimSpace(input.TempatLahir)
	}
	if input.TanggalLahir != "" {
		student.TanggalLahir = strings.TrimSpace(input.TanggalLahir)
	}
	if input.IsActive != nil {
		student.IsActive = *input.IsActive
	}

	student.IsManualOverride = true
	student.UpdatedAt = time.Now()

	if err := db.Save(&student).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal menyimpan perubahan siswa: " + err.Error()})
		return
	}

	if config.RDB != nil {
		_ = config.RDB.Del(config.RedisCtx, "master:rombels", "dashboard:stats").Err()
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Data peserta didik berhasil diperbarui",
		"student": student,
	})
}

type TransferStudentInput struct {
	TargetRombelID string `json:"target_rombel_id" binding:"required"`
}

func (ctrl *AdminMasterController) TransferStudentRombel(c *gin.Context) {
	studentID := c.Param("id")
	var input TransferStudentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Rombel tujuan wajib dipilih"})
		return
	}

	db := config.DB
	var student models.Student
	if err := db.First(&student, "id = ?", studentID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Peserta didik tidak ditemukan"})
		return
	}

	var targetRombel models.Rombel
	if err := db.First(&targetRombel, "id = ?", input.TargetRombelID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Rombel tujuan tidak ditemukan"})
		return
	}

	student.RombelID = input.TargetRombelID
	student.IsManualOverride = true
	student.UpdatedAt = time.Now()

	if err := db.Save(&student).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal memindahkan rombel siswa: " + err.Error()})
		return
	}

	if config.RDB != nil {
		_ = config.RDB.Del(config.RedisCtx, "master:rombels", "dashboard:stats").Err()
	}

	c.JSON(http.StatusOK, gin.H{
		"status":        "success",
		"message":       fmt.Sprintf("Siswa '%s' berhasil dipindahkan ke kelas %s", student.Name, targetRombel.Name),
		"student":       student,
		"target_rombel": targetRombel,
	})
}

func (ctrl *AdminMasterController) DeleteStudent(c *gin.Context) {
	studentID := c.Param("id")
	force := c.Query("force") == "true"
	db := config.DB

	var student models.Student
	if err := db.First(&student, "id = ?", studentID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Peserta didik tidak ditemukan"})
		return
	}

	if !force {
		// Soft delete: toggle is_active = false
		student.IsActive = false
		student.IsManualOverride = true
		student.UpdatedAt = time.Now()
		if err := db.Save(&student).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal menonaktifkan siswa: " + err.Error()})
			return
		}

		if config.RDB != nil {
			_ = config.RDB.Del(config.RedisCtx, "master:rombels", "dashboard:stats").Err()
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  "success",
			"message": "Peserta didik berhasil dinonaktifkan (soft delete). Riwayat nilai tetap aman.",
		})
		return
	}

	// Hard delete verification
	var gradeCount int64
	db.Model(&models.Grade{}).Where("student_id = ?", studentID).Count(&gradeCount)
	if gradeCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Peserta didik sudah memiliki riwayat nilai rapor. Penghapusan permanen ditolak demi keamanan data integritas rapor.",
		})
		return
	}

	if err := db.Delete(&student).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal menghapus siswa permanen: " + err.Error()})
		return
	}

	if config.RDB != nil {
		_ = config.RDB.Del(config.RedisCtx, "master:rombels", "dashboard:stats").Err()
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Peserta didik berhasil dihapus secara permanen",
	})
}

// -------------------------------------------------------------
// 2. MANAJEMEN GURU & PTK
// -------------------------------------------------------------

type TeacherListItem struct {
	models.User
	AssignmentCount int64           `json:"assignment_count"`
	WaliRombel      *models.Rombel  `json:"wali_rombel,omitempty"`
	WaliRombels     []models.Rombel `json:"wali_rombels,omitempty"`
}

func (ctrl *AdminMasterController) GetTeachers(c *gin.Context) {
	db := config.DB
	var users []models.User
	if err := db.Order("role ASC, name ASC").Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal memuat data guru"})
		return
	}

	// Ambil seluruh rombel dan hitung jumlah siswa per rombel
	var rombels []models.Rombel
	db.Find(&rombels)

	type RombelCount struct {
		RombelID string `gorm:"column:rombel_id"`
		Count    int64  `gorm:"column:count"`
	}
	var studentCounts []RombelCount
	db.Model(&models.Student{}).
		Select("rombel_id, count(*) as count").
		Group("rombel_id").
		Scan(&studentCounts)

	studentCountMap := make(map[string]int64, len(studentCounts))
	for _, sc := range studentCounts {
		studentCountMap[sc.RombelID] = sc.Count
	}

	for i := range rombels {
		rombels[i].StudentCount = studentCountMap[rombels[i].ID]
	}

	// Kelompokkan rombel berdasarkan wali_kelas_id
	teacherRombelsMap := make(map[string][]models.Rombel)
	for _, r := range rombels {
		if r.WaliKelasID != "" {
			teacherRombelsMap[r.WaliKelasID] = append(teacherRombelsMap[r.WaliKelasID], r)
		}
	}

	// Filter dan urutkan rombel untuk tiap guru:
	// Jika seorang guru mengampu wali kelas lebih dari 1 kelas (>= 2),
	// hilangkan kelas yang siswanya 0 jika ada kelas yang memiliki siswa > 0.
	waliMap := make(map[string]*models.Rombel)
	waliListMap := make(map[string][]models.Rombel)

	for teacherID, rList := range teacherRombelsMap {
		filteredList := rList
		if len(rList) > 1 {
			var withStudents []models.Rombel
			for _, r := range rList {
				if r.StudentCount > 0 {
					withStudents = append(withStudents, r)
				}
			}
			if len(withStudents) > 0 {
				filteredList = withStudents
			}
		}

		// Urutkan berdasarkan siswa terbanyak (StudentCount DESC), lalu Nama ASC
		sort.Slice(filteredList, func(i, j int) bool {
			if filteredList[i].StudentCount != filteredList[j].StudentCount {
				return filteredList[i].StudentCount > filteredList[j].StudentCount
			}
			return filteredList[i].Name < filteredList[j].Name
		})

		if len(filteredList) > 0 {
			primary := filteredList[0]
			waliMap[teacherID] = &primary
			waliListMap[teacherID] = filteredList
		}
	}

	// Bulk count assignments
	type AssignCount struct {
		GuruID string `gorm:"column:guru_id"`
		Count  int64  `gorm:"column:count"`
	}
	var counts []AssignCount
	db.Model(&models.TeachingAssignment{}).Select("guru_id, count(*) as count").Group("guru_id").Scan(&counts)
	countMap := make(map[string]int64, len(counts))
	for _, ac := range counts {
		countMap[ac.GuruID] = ac.Count
	}

	var results []TeacherListItem
	for _, u := range users {
		item := TeacherListItem{
			User:            u,
			AssignmentCount: countMap[u.ID],
			WaliRombel:      waliMap[u.ID],
			WaliRombels:     waliListMap[u.ID],
		}
		results = append(results, item)
	}

	c.JSON(http.StatusOK, gin.H{
		"status":   "success",
		"teachers": results,
		"count":    len(results),
	})
}

type CreateTeacherInput struct {
	Name     string `json:"name" binding:"required"`
	NipNik   string `json:"nip_nik"`
	Email    string `json:"email"`
	Phone    string `json:"phone"`
	Role     string `json:"role"` // guru / admin
	Password string `json:"password"`
}

func (ctrl *AdminMasterController) CreateTeacher(c *gin.Context) {
	var input CreateTeacherInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Nama guru wajib diisi"})
		return
	}

	db := config.DB
	nipNik := strings.TrimSpace(input.NipNik)
	email := strings.TrimSpace(input.Email)
	name := strings.TrimSpace(input.Name)

	if email == "" {
		cleanName := strings.ToLower(strings.ReplaceAll(name, " ", "."))
		email = fmt.Sprintf("%s@smk.sch.id", cleanName)
	}

	// Check duplicates
	if nipNik != "" {
		var existingNip int64
		db.Model(&models.User{}).Where("nip_nik = ?", nipNik).Count(&existingNip)
		if existingNip > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "NIP/NIK sudah terdaftar pada guru lain"})
			return
		}
	}

	var existingEmail int64
	db.Model(&models.User{}).Where("LOWER(email) = LOWER(?)", email).Count(&existingEmail)
	if existingEmail > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Email sudah digunakan oleh akun lain"})
		return
	}

	rawPassword := input.Password
	if rawPassword == "" {
		if nipNik != "" {
			rawPassword = nipNik
		} else {
			rawPassword = "guru" + strings.ToLower(strings.ReplaceAll(name, " ", ""))
		}
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(rawPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal mengenkripsi kata sandi"})
		return
	}

	role := models.RoleGuru
	if input.Role == string(models.RoleAdmin) {
		role = models.RoleAdmin
	}

	now := time.Now()
	user := models.User{
		ID:                uuid.NewString(),
		Name:              name,
		Email:             email,
		PasswordHash:      string(hash),
		Role:              role,
		NipNik:            nipNik,
		Phone:             strings.TrimSpace(input.Phone),
		IsInitialPassword: true,
		IsManualOverride:  true,
		IsActive:          true,
		CreatedAt:         now,
		UpdatedAt:         now,
	}

	if err := db.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal menambahkan guru: " + err.Error()})
		return
	}

	if config.RDB != nil {
		_ = config.RDB.Del(config.RedisCtx, "dashboard:stats").Err()
	}

	c.JSON(http.StatusOK, gin.H{
		"status":   "success",
		"message":  "Guru baru berhasil ditambahkan secara manual",
		"teacher":  user,
		"password": rawPassword,
	})
}

type UpdateTeacherInput struct {
	Name     string `json:"name"`
	NipNik   string `json:"nip_nik"`
	Email    string `json:"email"`
	Phone    string `json:"phone"`
	Role     string `json:"role"`
	IsActive *bool  `json:"is_active"`
}

func (ctrl *AdminMasterController) UpdateTeacher(c *gin.Context) {
	teacherID := c.Param("id")
	var input UpdateTeacherInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Format data tidak valid"})
		return
	}

	db := config.DB
	var user models.User
	if err := db.First(&user, "id = ?", teacherID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Data guru tidak ditemukan"})
		return
	}

	if strings.TrimSpace(input.Name) != "" {
		user.Name = strings.TrimSpace(input.Name)
	}
	if strings.TrimSpace(input.NipNik) != "" {
		user.NipNik = strings.TrimSpace(input.NipNik)
	}
	if strings.TrimSpace(input.Email) != "" {
		user.Email = strings.TrimSpace(input.Email)
	}
	if input.Phone != "" {
		user.Phone = strings.TrimSpace(input.Phone)
	}
	if input.Role != "" {
		if input.Role == string(models.RoleAdmin) {
			user.Role = models.RoleAdmin
		} else {
			user.Role = models.RoleGuru
		}
	}
	if input.IsActive != nil {
		user.IsActive = *input.IsActive
	}

	user.IsManualOverride = true
	user.UpdatedAt = time.Now()

	if err := db.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal menyimpan perubahan guru: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Data guru berhasil diperbarui",
		"teacher": user,
	})
}

type ResetPasswordInput struct {
	NewPassword string `json:"new_password"`
}

func (ctrl *AdminMasterController) ResetTeacherPassword(c *gin.Context) {
	teacherID := c.Param("id")
	var input ResetPasswordInput
	_ = c.ShouldBindJSON(&input)

	db := config.DB
	var user models.User
	if err := db.First(&user, "id = ?", teacherID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Data guru tidak ditemukan"})
		return
	}

	newPass := strings.TrimSpace(input.NewPassword)
	if newPass == "" {
		if user.NipNik != "" {
			newPass = user.NipNik
		} else {
			newPass = "guru123"
		}
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPass), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal mengenkripsi kata sandi"})
		return
	}

	user.PasswordHash = string(hash)
	user.IsInitialPassword = true
	user.UpdatedAt = time.Now()

	if err := db.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal mereset kata sandi: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":       "success",
		"message":      fmt.Sprintf("Kata sandi akun %s berhasil direset ke: '%s'", user.Name, newPass),
		"new_password": newPass,
	})
}

func (ctrl *AdminMasterController) DeleteTeacher(c *gin.Context) {
	teacherID := c.Param("id")
	currentUserID, _ := c.Get("user_id")

	if currentUserID == teacherID {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Anda tidak dapat menonaktifkan akun sendiri"})
		return
	}

	db := config.DB
	var user models.User
	if err := db.First(&user, "id = ?", teacherID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Data guru tidak ditemukan"})
		return
	}

	// Soft delete / nonaktifkan
	user.IsActive = false
	user.IsManualOverride = true
	user.UpdatedAt = time.Now()

	if err := db.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal menonaktifkan guru: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Akun guru berhasil dinonaktifkan",
	})
}

// -------------------------------------------------------------
// 3. MANAJEMEN ROMBEL & WALI KELAS
// -------------------------------------------------------------

type SetWaliKelasInput struct {
	WaliKelasID string `json:"wali_kelas_id"` // Boleh kosong jika lepas jabatan
}

func (ctrl *AdminMasterController) SetWaliKelas(c *gin.Context) {
	rombelID := c.Param("id")
	var input SetWaliKelasInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Format data tidak valid"})
		return
	}

	db := config.DB
	var rombel models.Rombel
	if err := db.First(&rombel, "id = ?", rombelID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Rombel tidak ditemukan"})
		return
	}

	trimmedWali := strings.TrimSpace(input.WaliKelasID)
	if trimmedWali == "" {
		if err := db.Model(&models.Rombel{}).Where("id = ?", rombelID).Updates(map[string]interface{}{
			"wali_kelas_id":      nil,
			"is_manual_override": true,
			"updated_at":         time.Now(),
		}).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal mengosongkan Wali Kelas: " + err.Error()})
			return
		}
		if config.RDB != nil {
			_ = config.RDB.Del(config.RedisCtx, "master:rombels").Err()
		}
		rombel.WaliKelasID = ""
		c.JSON(http.StatusOK, gin.H{
			"status":  "success",
			"message": "Wali Kelas berhasil dikosongkan",
			"rombel":  rombel,
		})
		return
	}

	var guru models.User
	if err := db.First(&guru, "id = ?", trimmedWali).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Guru yang dipilih tidak ditemukan"})
		return
	}

	rombel.WaliKelasID = trimmedWali
	rombel.IsManualOverride = true
	rombel.UpdatedAt = time.Now()

	if err := db.Save(&rombel).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal memperbarui Wali Kelas: " + err.Error()})
		return
	}

	if config.RDB != nil {
		_ = config.RDB.Del(config.RedisCtx, "master:rombels").Err()
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Wali Kelas berhasil diperbarui",
		"rombel":  rombel,
	})
}

type CreateRombelInput struct {
	Name        string `json:"name" binding:"required"`
	Tingkat     int    `json:"tingkat" binding:"required"` // 10, 11, 12
	WaliKelasID string `json:"wali_kelas_id"`
}

func (ctrl *AdminMasterController) CreateRombel(c *gin.Context) {
	var input CreateRombelInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Nama rombel dan tingkat kelas wajib diisi"})
		return
	}

	db := config.DB
	now := time.Now()
	rombelID := fmt.Sprintf("rombel-%s", strings.ToLower(strings.ReplaceAll(strings.TrimSpace(input.Name), " ", "-")))

	trimmedWali := strings.TrimSpace(input.WaliKelasID)
	if trimmedWali != "" {
		var guru models.User
		if err := db.First(&guru, "id = ?", trimmedWali).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Guru wali kelas yang dipilih tidak ditemukan"})
			return
		}
	}

	rombel := models.Rombel{
		ID:               rombelID,
		Name:             strings.TrimSpace(input.Name),
		Tingkat:          input.Tingkat,
		WaliKelasID:      trimmedWali,
		IsManualOverride: true,
		CreatedAt:        now,
		UpdatedAt:        now,
	}

	var err error
	if trimmedWali == "" {
		err = db.Omit("wali_kelas_id").Create(&rombel).Error
	} else {
		err = db.Create(&rombel).Error
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal membuat rombel baru: " + err.Error()})
		return
	}

	if config.RDB != nil {
		_ = config.RDB.Del(config.RedisCtx, "master:rombels", "dashboard:stats").Err()
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Rombongan belajar baru berhasil dibuat secara manual",
		"rombel":  rombel,
	})
}

// -------------------------------------------------------------
// 4. MANAJEMEN PENUGASAN MENGAJAR
// -------------------------------------------------------------

type CreateTeachingAssignmentInput struct {
	GuruID       string   `json:"guru_id" binding:"required"`
	SubjectID    string   `json:"subject_id" binding:"required"`
	RombelID     string   `json:"rombel_id"`
	RombelIDs    []string `json:"rombel_ids"`
	JamPerMinggu int      `json:"jam_per_minggu"`
}

func (ctrl *AdminMasterController) CreateTeachingAssignment(c *gin.Context) {
	var input CreateTeachingAssignmentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Guru dan Mata Pelajaran wajib dipilih"})
		return
	}

	targetRombelIDs := make([]string, 0)
	seen := make(map[string]bool)

	if trimmed := strings.TrimSpace(input.RombelID); trimmed != "" && !seen[trimmed] {
		targetRombelIDs = append(targetRombelIDs, trimmed)
		seen[trimmed] = true
	}
	for _, rid := range input.RombelIDs {
		if trimmed := strings.TrimSpace(rid); trimmed != "" && !seen[trimmed] {
			targetRombelIDs = append(targetRombelIDs, trimmed)
			seen[trimmed] = true
		}
	}

	if len(targetRombelIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Minimal pilih satu rombongan belajar (kelas)"})
		return
	}

	db := config.DB
	now := time.Now()

	var createdAssignments []models.TeachingAssignment
	var skippedCount int

	err := db.Transaction(func(tx *gorm.DB) error {
		// Bulk check existing assignments for this (guru, subject) across all target rombels in 1 single query
		var existingList []models.TeachingAssignment
		if err := tx.Where("guru_id = ? AND subject_id = ? AND rombel_id IN ?", input.GuruID, input.SubjectID, targetRombelIDs).
			Find(&existingList).Error; err != nil {
			return err
		}

		existingMap := make(map[string]bool, len(existingList))
		for _, ex := range existingList {
			existingMap[ex.RombelID] = true
		}

		for _, rombelID := range targetRombelIDs {
			if existingMap[rombelID] {
				skippedCount++
				continue
			}

			assign := models.TeachingAssignment{
				ID:               uuid.NewString(),
				GuruID:           input.GuruID,
				SubjectID:        input.SubjectID,
				RombelID:         rombelID,
				JamPerMinggu:     input.JamPerMinggu,
				IsManualOverride: true,
				CreatedAt:        now,
				UpdatedAt:        now,
			}
			createdAssignments = append(createdAssignments, assign)
		}

		if len(createdAssignments) > 0 {
			if err := tx.CreateInBatches(createdAssignments, 100).Error; err != nil {
				return err
			}
		}

		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal membuat penugasan mengajar: " + err.Error()})
		return
	}

	if len(createdAssignments) == 0 && skippedCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Semua kelas yang dipilih sudah memiliki penugasan untuk guru dan mata pelajaran ini",
		})
		return
	}

	if config.RDB != nil {
		_ = config.RDB.Del(config.RedisCtx, "dashboard:stats").Err()
	}

	var msg string
	if len(createdAssignments) == 1 && skippedCount == 0 {
		msg = "Penugasan mengajar berhasil ditambahkan secara manual"
	} else if skippedCount > 0 {
		msg = fmt.Sprintf("%d penugasan mengajar berhasil ditambahkan (%d kelas dilewati karena sudah ada)", len(createdAssignments), skippedCount)
	} else {
		msg = fmt.Sprintf("%d penugasan mengajar berhasil ditambahkan", len(createdAssignments))
	}

	var firstAssign *models.TeachingAssignment
	if len(createdAssignments) > 0 {
		firstAssign = &createdAssignments[0]
	}

	c.JSON(http.StatusOK, gin.H{
		"status":        "success",
		"message":       msg,
		"assignment":    firstAssign,
		"assignments":   createdAssignments,
		"created_count": len(createdAssignments),
		"skipped_count": skippedCount,
	})
}

func (ctrl *AdminMasterController) DeleteTeachingAssignment(c *gin.Context) {
	assignID := c.Param("id")
	db := config.DB

	if err := db.Delete(&models.TeachingAssignment{}, "id = ?", assignID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal menghapus penugasan mengajar: " + err.Error()})
		return
	}

	if config.RDB != nil {
		_ = config.RDB.Del(config.RedisCtx, "dashboard:stats").Err()
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Penugasan mengajar berhasil dihapus",
	})
}

// -------------------------------------------------------------
// 5. MANAJEMEN MATA PELAJARAN (SUBJECT)
// -------------------------------------------------------------

type CreateSubjectInput struct {
	Nama     string `json:"nama" binding:"required"`
	Kelompok string `json:"kelompok"` // A, B, C, Mulok, dll
}

func (ctrl *AdminMasterController) CreateSubject(c *gin.Context) {
	var input CreateSubjectInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Nama mata pelajaran wajib diisi"})
		return
	}

	db := config.DB
	now := time.Now()
	cleanName := strings.TrimSpace(input.Nama)
	kelompok := strings.TrimSpace(input.Kelompok)
	if kelompok == "" {
		kelompok = "B" // Default kejuruan
	}

	// Generate clean ID
	slug := strings.ToLower(strings.ReplaceAll(cleanName, " ", "-"))
	subjectID := fmt.Sprintf("sub-%s", slug)

	// Check if already exists
	var existing models.Subject
	if err := db.First(&existing, "id = ?", subjectID).Error; err == nil {
		subjectID = fmt.Sprintf("sub-%s-%d", slug, time.Now().Unix()%1000)
	}

	subject := models.Subject{
		ID:               subjectID,
		Nama:             cleanName,
		Kelompok:         kelompok,
		IsManualOverride: true,
		CreatedAt:        now,
		UpdatedAt:        now,
	}

	if err := db.Create(&subject).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal menambahkan mata pelajaran: " + err.Error()})
		return
	}

	if config.RDB != nil {
		_ = config.RDB.Del(config.RedisCtx, "master:subjects", "dashboard:stats").Err()
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Mata pelajaran baru berhasil ditambahkan secara manual",
		"subject": subject,
	})
}

type UpdateSubjectInput struct {
	Nama     string `json:"nama" binding:"required"`
	Kelompok string `json:"kelompok"`
}

func (ctrl *AdminMasterController) UpdateSubject(c *gin.Context) {
	subjectID := c.Param("id")
	var input UpdateSubjectInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Nama mata pelajaran wajib diisi"})
		return
	}

	db := config.DB
	var subject models.Subject
	if err := db.First(&subject, "id = ?", subjectID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Mata pelajaran tidak ditemukan"})
		return
	}

	subject.Nama = strings.TrimSpace(input.Nama)
	if strings.TrimSpace(input.Kelompok) != "" {
		subject.Kelompok = strings.TrimSpace(input.Kelompok)
	}
	subject.IsManualOverride = true
	subject.UpdatedAt = time.Now()

	if err := db.Save(&subject).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal memperbarui mata pelajaran: " + err.Error()})
		return
	}

	if config.RDB != nil {
		_ = config.RDB.Del(config.RedisCtx, "master:subjects", "dashboard:stats").Err()
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Mata pelajaran berhasil diperbarui",
		"subject": subject,
	})
}

func (ctrl *AdminMasterController) DeleteSubject(c *gin.Context) {
	subjectID := c.Param("id")
	db := config.DB

	var subject models.Subject
	if err := db.First(&subject, "id = ?", subjectID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Mata pelajaran tidak ditemukan"})
		return
	}

	// Verify no grades exist
	var gradeCount int64
	db.Model(&models.Grade{}).Where("subject_id = ?", subjectID).Count(&gradeCount)
	if gradeCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Mata pelajaran ini sudah memiliki riwayat nilai siswa. Penghapusan ditolak demi integritas rapor.",
		})
		return
	}

	// Clean up teaching assignments & TPs
	db.Where("subject_id = ?", subjectID).Delete(&models.TeachingAssignment{})
	db.Where("subject_id = ?", subjectID).Delete(&models.LearningObjective{})

	if err := db.Delete(&subject).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal menghapus mata pelajaran: " + err.Error()})
		return
	}

	if config.RDB != nil {
		_ = config.RDB.Del(config.RedisCtx, "master:subjects", "dashboard:stats").Err()
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Mata pelajaran berhasil dihapus",
	})
}

// BulkUpdateSubjectKelompokInput represents payload for bulk assigning subject groups
type BulkUpdateSubjectKelompokInput struct {
	SubjectIDs []string `json:"subject_ids" binding:"required"`
	Kelompok   string   `json:"kelompok" binding:"required"`
}

func (ctrl *AdminMasterController) BulkUpdateSubjectKelompok(c *gin.Context) {
	var input BulkUpdateSubjectKelompokInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Daftar ID mata pelajaran dan kelompok tujuan wajib diisi"})
		return
	}

	if len(input.SubjectIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Pilih setidaknya satu mata pelajaran"})
		return
	}

	targetKelompok := strings.TrimSpace(input.Kelompok)
	if targetKelompok == "" {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Nama kelompok tujuan tidak boleh kosong"})
		return
	}

	db := config.DB
	result := db.Model(&models.Subject{}).
		Where("id IN ?", input.SubjectIDs).
		Updates(map[string]interface{}{
			"kelompok":           targetKelompok,
			"is_manual_override": true,
			"updated_at":         time.Now(),
		})

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal memperbarui kelompok mata pelajaran: " + result.Error.Error()})
		return
	}

	if config.RDB != nil {
		_ = config.RDB.Del(config.RedisCtx, "master:subjects", "dashboard:stats").Err()
	}

	c.JSON(http.StatusOK, gin.H{
		"status":          "success",
		"message":         fmt.Sprintf("%d mata pelajaran berhasil dipindahkan ke Kelompok %s", result.RowsAffected, targetKelompok),
		"updated_count":   result.RowsAffected,
		"target_kelompok": targetKelompok,
	})
}

// ReorderSubjectItem represents single subject order payload
type ReorderSubjectItem struct {
	ID       string  `json:"id" binding:"required"`
	Urutan   int     `json:"urutan"`
	Kelompok *string `json:"kelompok"`
}

type ReorderSubjectsInput struct {
	Orders []ReorderSubjectItem `json:"orders" binding:"required"`
}

func (ctrl *AdminMasterController) ReorderSubjects(c *gin.Context) {
	var input ReorderSubjectsInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Format data urutan mata pelajaran tidak valid"})
		return
	}

	if len(input.Orders) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Daftar urutan mata pelajaran kosong"})
		return
	}

	db := config.DB
	tx := db.Begin()

	// Single query batch update untuk PostgreSQL (VALUES syntax)
	valParts := make([]string, 0, len(input.Orders))
	args := make([]interface{}, 0, len(input.Orders)*3)
	for _, item := range input.Orders {
		valParts = append(valParts, "(?::varchar, ?::int, ?::varchar)")
		var kelompokVal interface{}
		if item.Kelompok != nil && strings.TrimSpace(*item.Kelompok) != "" {
			kelompokVal = strings.TrimSpace(*item.Kelompok)
		}
		args = append(args, item.ID, item.Urutan, kelompokVal)
	}

	query := fmt.Sprintf(`
		UPDATE subjects AS s
		SET urutan = v.urutan,
		    kelompok = COALESCE(v.kelompok, s.kelompok),
		    is_manual_override = CASE WHEN v.kelompok IS NOT NULL THEN true ELSE s.is_manual_override END,
		    updated_at = NOW()
		FROM (VALUES %s) AS v(id, urutan, kelompok)
		WHERE s.id = v.id
	`, strings.Join(valParts, ", "))

	if err := tx.Exec(query, args...).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal menyimpan urutan mata pelajaran: " + err.Error()})
		return
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal menyimpan transaksi urutan: " + err.Error()})
		return
	}

	if config.RDB != nil {
		_ = config.RDB.Del(config.RedisCtx, "master:subjects", "dashboard:stats").Err()
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": fmt.Sprintf("Berhasil memperbarui urutan %d mata pelajaran", len(input.Orders)),
	})
}

type ReorderSubjectGroupItem struct {
	Kode   string `json:"kode" binding:"required"`
	Urutan int    `json:"urutan"`
}

type ReorderSubjectGroupsInput struct {
	Orders []ReorderSubjectGroupItem `json:"orders" binding:"required"`
}

func (ctrl *AdminMasterController) ReorderSubjectGroups(c *gin.Context) {
	var input ReorderSubjectGroupsInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Format data urutan kelompok tidak valid"})
		return
	}

	if len(input.Orders) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Daftar urutan kelompok kosong"})
		return
	}

	db := config.DB
	tx := db.Begin()

	// Single query batch update untuk subject_groups
	valParts := make([]string, 0, len(input.Orders))
	args := make([]interface{}, 0, len(input.Orders)*2)
	for _, item := range input.Orders {
		valParts = append(valParts, "(?::varchar, ?::int)")
		args = append(args, strings.TrimSpace(item.Kode), item.Urutan)
	}

	query := fmt.Sprintf(`
		UPDATE subject_groups AS sg
		SET urutan = v.urutan,
		    updated_at = NOW()
		FROM (VALUES %s) AS v(kode, urutan)
		WHERE LOWER(sg.kode) = LOWER(v.kode)
	`, strings.Join(valParts, ", "))

	if err := tx.Exec(query, args...).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal menyimpan urutan kelompok: " + err.Error()})
		return
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal menyimpan transaksi urutan kelompok: " + err.Error()})
		return
	}

	if config.RDB != nil {
		_ = config.RDB.Del(config.RedisCtx, "master:subjects", "dashboard:stats").Err()
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": fmt.Sprintf("Berhasil memperbarui urutan %d kelompok mata pelajaran", len(input.Orders)),
	})
}

// SubjectGroupSummaryItem represents aggregate stats for subject groups
type SubjectGroupSummaryItem struct {
	Kode      string           `json:"kode"`
	Nama      string           `json:"nama"`
	Deskripsi string           `json:"deskripsi"`
	Urutan    int              `json:"urutan"`
	Count     int              `json:"count"`
	Subjects  []models.Subject `json:"subjects"`
}

func (ctrl *AdminMasterController) GetSubjectGroupsSummary(c *gin.Context) {
	db := config.DB

	var dbGroups []models.SubjectGroup
	_ = db.Order("urutan ASC, kode ASC").Find(&dbGroups).Error

	var subjects []models.Subject
	if err := db.Order("kelompok ASC, urutan ASC, nama ASC").Find(&subjects).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal memuat mata pelajaran: " + err.Error()})
		return
	}

	subjectsMap := make(map[string][]models.Subject)
	for _, s := range subjects {
		k := strings.TrimSpace(s.Kelompok)
		if k == "" {
			k = "Lainnya"
		}
		subjectsMap[k] = append(subjectsMap[k], s)
	}

	result := make([]SubjectGroupSummaryItem, 0)
	handledKeys := make(map[string]bool)

	for _, dg := range dbGroups {
		handledKeys[dg.Kode] = true
		subs := subjectsMap[dg.Kode]
		if subs == nil {
			subs = []models.Subject{}
		}
		result = append(result, SubjectGroupSummaryItem{
			Kode:      dg.Kode,
			Nama:      dg.Nama,
			Deskripsi: dg.Deskripsi,
			Urutan:    dg.Urutan,
			Count:     len(subs),
			Subjects:  subs,
		})
	}

	for k, subs := range subjectsMap {
		if !handledKeys[k] {
			nama := "Kelompok " + k
			deskripsi := "Kelompok mata pelajaran kustom."
			if k == "Lainnya" {
				nama = "Belum Dikelompokkan"
				deskripsi = "Mata pelajaran yang belum ditentukan kelompoknya."
			}
			result = append(result, SubjectGroupSummaryItem{
				Kode:      k,
				Nama:      nama,
				Deskripsi: deskripsi,
				Urutan:    len(result) + 1,
				Count:     len(subs),
				Subjects:  subs,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status":         "success",
		"groups":         result,
		"total_subjects": len(subjects),
	})
}

type CreateSubjectGroupInput struct {
	Kode       string   `json:"kode" binding:"required"`
	Nama       string   `json:"nama" binding:"required"`
	Deskripsi  string   `json:"deskripsi"`
	Urutan     int      `json:"urutan"`
	SubjectIDs []string `json:"subject_ids"`
}

func (ctrl *AdminMasterController) CreateSubjectGroup(c *gin.Context) {
	var input CreateSubjectGroupInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Kode dan nama kelompok wajib diisi"})
		return
	}

	kode := strings.TrimSpace(input.Kode)
	nama := strings.TrimSpace(input.Nama)
	if kode == "" || nama == "" {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Kode dan nama kelompok tidak boleh kosong"})
		return
	}

	db := config.DB

	var existing models.SubjectGroup
	if err := db.Where("LOWER(kode) = LOWER(?)", kode).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": fmt.Sprintf("Kelompok dengan kode '%s' sudah terdaftar", kode)})
		return
	}

	urutan := input.Urutan
	if urutan <= 0 {
		var maxUrutan int
		db.Model(&models.SubjectGroup{}).Select("COALESCE(MAX(urutan), 0)").Scan(&maxUrutan)
		urutan = maxUrutan + 1
	}

	group := models.SubjectGroup{
		Kode:      kode,
		Nama:      nama,
		Deskripsi: strings.TrimSpace(input.Deskripsi),
		Urutan:    urutan,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	tx := db.Begin()
	if err := tx.Create(&group).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal menyimpan kelompok: " + err.Error()})
		return
	}

	if len(input.SubjectIDs) > 0 {
		if err := tx.Model(&models.Subject{}).
			Where("id IN ?", input.SubjectIDs).
			Updates(map[string]interface{}{
				"kelompok":           kode,
				"is_manual_override": true,
				"updated_at":         time.Now(),
			}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal menugaskan mapel: " + err.Error()})
			return
		}
	}

	tx.Commit()

	if config.RDB != nil {
		_ = config.RDB.Del(config.RedisCtx, "master:subjects", "dashboard:stats").Err()
	}

	c.JSON(http.StatusCreated, gin.H{
		"status":  "success",
		"message": fmt.Sprintf("Kelompok '%s' berhasil dibuat", group.Nama),
		"group":   group,
	})
}

type UpdateSubjectGroupInput struct {
	Kode      string `json:"kode"`
	Nama      string `json:"nama" binding:"required"`
	Deskripsi string `json:"deskripsi"`
	Urutan    *int   `json:"urutan"`
}

func (ctrl *AdminMasterController) UpdateSubjectGroup(c *gin.Context) {
	currentKode := strings.TrimSpace(c.Param("kode"))
	if currentKode == "" {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Kode kelompok target wajib ditentukan"})
		return
	}

	var input UpdateSubjectGroupInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Nama kelompok wajib diisi"})
		return
	}

	nama := strings.TrimSpace(input.Nama)
	if nama == "" {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Nama kelompok tidak boleh kosong"})
		return
	}

	db := config.DB

	var group models.SubjectGroup
	if err := db.Where("LOWER(kode) = LOWER(?)", currentKode).First(&group).Error; err != nil {
		group = models.SubjectGroup{
			Kode:      currentKode,
			Nama:      nama,
			Deskripsi: strings.TrimSpace(input.Deskripsi),
			Urutan:    1,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
		if err := db.Create(&group).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal menginisialisasi kelompok: " + err.Error()})
			return
		}
	}

	newKode := strings.TrimSpace(input.Kode)
	if newKode == "" {
		newKode = group.Kode
	}

	urutan := group.Urutan
	if input.Urutan != nil {
		urutan = *input.Urutan
	}

	tx := db.Begin()

	if !strings.EqualFold(newKode, group.Kode) {
		var dupCount int64
		tx.Model(&models.SubjectGroup{}).Where("LOWER(kode) = LOWER(?) AND LOWER(kode) != LOWER(?)", newKode, group.Kode).Count(&dupCount)
		if dupCount > 0 {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": fmt.Sprintf("Kode '%s' sudah digunakan oleh kelompok lain", newKode)})
			return
		}

		if err := tx.Model(&models.Subject{}).
			Where("kelompok = ?", group.Kode).
			Updates(map[string]interface{}{
				"kelompok":   newKode,
				"updated_at": time.Now(),
			}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal memperbarui kelompok pada mata pelajaran: " + err.Error()})
			return
		}

		if err := tx.Exec("UPDATE subject_groups SET kode = ?, nama = ?, deskripsi = ?, urutan = ?, updated_at = ? WHERE kode = ?",
			newKode, nama, strings.TrimSpace(input.Deskripsi), urutan, time.Now(), group.Kode).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal memperbarui data kelompok: " + err.Error()})
			return
		}
		group.Kode = newKode
	} else {
		if err := tx.Model(&models.SubjectGroup{}).
			Where("kode = ?", group.Kode).
			Updates(map[string]interface{}{
				"nama":       nama,
				"deskripsi":  strings.TrimSpace(input.Deskripsi),
				"urutan":     urutan,
				"updated_at": time.Now(),
			}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal memperbarui kelompok: " + err.Error()})
			return
		}
	}

	tx.Commit()

	group.Nama = nama
	group.Deskripsi = strings.TrimSpace(input.Deskripsi)
	group.Urutan = urutan

	if config.RDB != nil {
		_ = config.RDB.Del(config.RedisCtx, "master:subjects", "dashboard:stats").Err()
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": fmt.Sprintf("Kelompok '%s' berhasil diperbarui", group.Nama),
		"group":   group,
	})
}

func (ctrl *AdminMasterController) DeleteSubjectGroup(c *gin.Context) {
	kode := strings.TrimSpace(c.Param("kode"))
	if kode == "" {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Kode kelompok wajib ditentukan"})
		return
	}

	if strings.EqualFold(kode, "A") || strings.EqualFold(kode, "B") {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Kelompok A dan B adalah muatan inti standar kurikulum dan tidak dapat dihapus"})
		return
	}

	targetKelompok := strings.TrimSpace(c.Query("target_kelompok"))
	if targetKelompok == "" {
		targetKelompok = "B"
	}

	db := config.DB
	tx := db.Begin()

	if err := tx.Model(&models.Subject{}).
		Where("kelompok = ?", kode).
		Updates(map[string]interface{}{
			"kelompok":   targetKelompok,
			"updated_at": time.Now(),
		}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal memindahkan mata pelajaran: " + err.Error()})
		return
	}

	if err := tx.Where("kode = ?", kode).Delete(&models.SubjectGroup{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Gagal menghapus kelompok: " + err.Error()})
		return
	}

	tx.Commit()

	if config.RDB != nil {
		_ = config.RDB.Del(config.RedisCtx, "master:subjects", "dashboard:stats").Err()
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": fmt.Sprintf("Kelompok '%s' berhasil dihapus. Mapel dialihkan ke Kelompok '%s'.", kode, targetKelompok),
	})
}

