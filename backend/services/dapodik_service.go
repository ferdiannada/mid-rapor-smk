package services

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"rapor-smk-backend/config"
	"rapor-smk-backend/models"
)

var syncInProgressFlag int32

type DapodikService struct {
	BaseURL          string
	Token            string
	NPSN             string
	Client           *http.Client
	mockDataDetected bool
}

func NewDapodikService() *DapodikService {
	timeout := 30 * time.Second

	var cfg models.DapodikConfig
	if config.DB != nil && config.DB.Where("is_active = ?", true).Order("updated_at DESC").First(&cfg).Error == nil {
		if cfg.TimeoutSeconds > 0 {
			timeout = time.Duration(cfg.TimeoutSeconds) * time.Second
		}
		host := cfg.DapodikHost
		host = strings.TrimPrefix(host, "http://")
		host = strings.TrimPrefix(host, "https://")
		if parts := strings.Split(host, ":"); len(parts) > 0 {
			host = parts[0]
		}
		baseURL := fmt.Sprintf("http://%s:%d", host, cfg.DapodikPort)
		return &DapodikService{
			BaseURL: baseURL,
			Token:   cfg.DapodikToken,
			NPSN:    cfg.Npsn,
			Client:  &http.Client{Timeout: timeout},
		}
	}

	// Fallback to env
	envHost := os.Getenv("DAPODIK_URL")
	if envHost == "" {
		envHost = "http://localhost:5774"
	}
	if !strings.HasPrefix(envHost, "http://") && !strings.HasPrefix(envHost, "https://") {
		envHost = "http://" + envHost
	}

	return &DapodikService{
		BaseURL: envHost,
		Token:   os.Getenv("DAPODIK_TOKEN"),
		NPSN:    os.Getenv("NPSN"),
		Client:  &http.Client{Timeout: timeout},
	}
}

func (s *DapodikService) fetch(endpoint string) ([]byte, error) {
	if s.BaseURL == "mock" || s.Token == "mock" {
		s.mockDataDetected = true
		return s.getMockData(endpoint)
	}

	url := fmt.Sprintf("%s/WebService/%s?npsn=%s", s.BaseURL, endpoint, s.NPSN)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("gagal membuat request ke Dapodik (%s): %w", endpoint, err)
	}

	req.Header.Set("Authorization", "Bearer "+s.Token)

	resp, err := s.Client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("koneksi ke Dapodik gagal (%s): %w", endpoint, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("dapodik API (%s) merespon status HTTP %d", endpoint, resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 15*1024*1024))
	if err != nil {
		return nil, fmt.Errorf("gagal membaca data dari Dapodik (%s): %w", endpoint, err)
	}

	trimmed := strings.TrimSpace(string(body))
	// Dapodik PHP web service terkadang menyertakan header HTTP di awal body respons
	jsonStart := -1
	for i, c := range trimmed {
		if c == '{' || c == '[' {
			jsonStart = i
			break
		}
	}
	if jsonStart == -1 {
		return nil, fmt.Errorf("respons Dapodik (%s) bukan format JSON yang valid", endpoint)
	}

	jsonPayload := []byte(trimmed[jsonStart:])

	// Cek apakah respons berupa payload error dari Dapodik (misal: success: false)
	var errObj struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(jsonPayload, &errObj); err == nil && !errObj.Success && errObj.Message != "" {
		return nil, fmt.Errorf("dapodik (%s): %s", endpoint, errObj.Message)
	}

	return jsonPayload, nil
}

func parseDapodikArray(jsonData []byte) ([]map[string]interface{}, error) {
	var directArray []map[string]interface{}
	if err := json.Unmarshal(jsonData, &directArray); err == nil {
		return directArray, nil
	}

	var wrapper map[string]interface{}
	if err := json.Unmarshal(jsonData, &wrapper); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %v", err)
	}

	rowsVal, ok := wrapper["rows"]
	if !ok {
		return nil, fmt.Errorf("json is an object but 'rows' key not found")
	}

	rowsBytes, err := json.Marshal(rowsVal)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal rows value: %v", err)
	}

	var rowsArray []map[string]interface{}
	if err := json.Unmarshal(rowsBytes, &rowsArray); err != nil {
		return nil, fmt.Errorf("failed to parse rows array: %v", err)
	}

	return rowsArray, nil
}

func computeDataHash(fields ...string) string {
	h := sha256.New()
	for _, f := range fields {
		h.Write([]byte(f))
		h.Write([]byte{0})
	}
	return hex.EncodeToString(h.Sum(nil))
}

type SyncOptions struct {
	SyncGtk                  bool `json:"sync_gtk"`
	SyncRombel               bool `json:"sync_rombel"`
	SyncSiswa                bool `json:"sync_siswa"`
	SyncPembelajaran         bool `json:"sync_pembelajaran"`
	DryRun                   bool `json:"dry_run"`
	PreserveManualOverrides bool `json:"preserve_manual_overrides"`
}

type SyncCategoryStat struct {
	Created int `json:"created"`
	Updated int `json:"updated"`
	Skipped int `json:"skipped"`
	Failed  int `json:"failed"`
}

type SyncSummary struct {
	Status           string                      `json:"status"`
	DurationMs       int64                       `json:"duration_ms"`
	MockDataDetected bool                        `json:"mock_data_detected"`
	Summary          map[string]SyncCategoryStat `json:"summary"`
	Details          []string                    `json:"details"`
}

// PurgeMockData menghapus data mock dan data uji coba dari database
// dengan tetap mempertahankan akun dengan role admin.
func PurgeMockData(db *gorm.DB) error {
	return db.Transaction(func(tx *gorm.DB) error {
		// 1. Rincian nilai terkait mock learning objective atau mock grade
		if err := tx.Exec(`
			DELETE FROM grade_details 
			WHERE learning_objective_id LIKE 'tp-%' 
			   OR grade_id IN (SELECT id FROM grades WHERE student_id LIKE 'siswa-%' OR rombel_id LIKE 'rombel-%')
		`).Error; err != nil {
			return fmt.Errorf("purge grade_details: %w", err)
		}

		// 2. Nilai mock
		if err := tx.Exec(`
			DELETE FROM grades 
			WHERE student_id LIKE 'siswa-%' OR rombel_id LIKE 'rombel-%'
		`).Error; err != nil {
			return fmt.Errorf("purge grades: %w", err)
		}

		// 3. Presensi mock
		if err := tx.Exec(`
			DELETE FROM attendances 
			WHERE student_id LIKE 'siswa-%' OR rombel_id LIKE 'rombel-%'
		`).Error; err != nil {
			return fmt.Errorf("purge attendances: %w", err)
		}

		// 4. Ekstrakurikuler mock
		if err := tx.Exec(`
			DELETE FROM extracurriculars 
			WHERE student_id LIKE 'siswa-%' OR rombel_id LIKE 'rombel-%'
		`).Error; err != nil {
			return fmt.Errorf("purge extracurriculars: %w", err)
		}

		// 5. Catatan wali kelas mock
		if err := tx.Exec(`
			DELETE FROM wali_kelas_notes 
			WHERE student_id LIKE 'siswa-%' OR rombel_id LIKE 'rombel-%'
		`).Error; err != nil {
			return fmt.Errorf("purge wali_kelas_notes: %w", err)
		}

		// 6. Tujuan pembelajaran mock
		if err := tx.Exec(`
			DELETE FROM learning_objectives 
			WHERE id LIKE 'tp-%'
		`).Error; err != nil {
			return fmt.Errorf("purge learning_objectives: %w", err)
		}

		// 7. Penugasan mengajar mock
		if err := tx.Exec(`
			DELETE FROM teaching_assignments 
			WHERE id LIKE 'pemb-%' OR guru_id LIKE 'guru-%' OR rombel_id LIKE 'rombel-%'
		`).Error; err != nil {
			return fmt.Errorf("purge teaching_assignments: %w", err)
		}

		// 8. Siswa mock dan dummy uji coba
		if err := tx.Exec(`
			DELETE FROM students 
			WHERE id LIKE 'siswa-%' OR rombel_id LIKE 'rombel-%'
		`).Error; err != nil {
			return fmt.Errorf("purge students: %w", err)
		}

		// 9. Rombel mock
		if err := tx.Exec(`
			DELETE FROM rombels 
			WHERE id LIKE 'rombel-%'
		`).Error; err != nil {
			return fmt.Errorf("purge rombels: %w", err)
		}

		// 10. Pengguna mock/dummy non-admin
		// Akun dengan role admin selalu dijaga agar tidak terhapus
		if err := tx.Exec(`
			DELETE FROM users 
			WHERE role != 'admin' 
			  AND (
				id LIKE 'guru-%' 
				OR email LIKE 'budi.%@smk.sch.id' 
				OR email IN ('hendra.wijaya@smk.sch.id', 'budi.rahardjo@smk.sch.id')
			  )
		`).Error; err != nil {
			return fmt.Errorf("purge users: %w", err)
		}

		return nil
	})
}

func (s *DapodikService) SyncDataWithOptions(opts SyncOptions, updatedBy string) (*SyncSummary, error) {
	// Distributed lock via Redis with fallback to local atomic flag
	if config.RDB != nil {
		acquired, err := config.RDB.SetNX(config.RedisCtx, "lock:dapodik_sync", "active", 15*time.Minute).Result()
		if err == nil && !acquired {
			return nil, fmt.Errorf("proses sinkronisasi Dapodik sedang berlangsung di server. Mohon tunggu beberapa saat...")
		}
		if acquired {
			defer config.RDB.Del(config.RedisCtx, "lock:dapodik_sync")
		}
	}

	if !atomic.CompareAndSwapInt32(&syncInProgressFlag, 0, 1) {
		return nil, fmt.Errorf("proses sinkronisasi Dapodik sedang berlangsung oleh permintaan lain. Mohon tunggu...")
	}
	defer atomic.StoreInt32(&syncInProgressFlag, 0)

	startTime := time.Now()
	summary := &SyncSummary{
		Status:  "success",
		Summary: make(map[string]SyncCategoryStat),
		Details: make([]string, 0),
	}

	summary.Summary["gtk"] = SyncCategoryStat{}
	summary.Summary["rombel"] = SyncCategoryStat{}
	summary.Summary["siswa"] = SyncCategoryStat{}
	summary.Summary["mapel"] = SyncCategoryStat{}
	summary.Summary["penugasan"] = SyncCategoryStat{}

	db := config.DB

	// Pembersihan data mockup/dummy sebelum memulai sinkronisasi (kecuali milik admin)
	if !opts.DryRun {
		if err := PurgeMockData(db); err != nil {
			log.Printf("Warning: Gagal membersihkan mock data: %v", err)
		} else {
			summary.Details = append(summary.Details, "Pembersihan data mockup dan dummy pengujian berhasil dilakukan (kecuali akun admin)")
		}
	} else {
		summary.Details = append(summary.Details, "[Mode Simulasi] Data mockup akan dibersihkan saat sinkronisasi aktual dijalankan")
	}

	var hasError bool
	var hasSuccess bool

	// 1. SYNC GTK (GURU)
	if opts.SyncGtk {
		stat, details, err := s.syncGTK(db, opts.DryRun, opts.PreserveManualOverrides)
		if err != nil {
			hasError = true
			log.Printf("Error syncing GTK: %v", err)
			summary.Details = append(summary.Details, fmt.Sprintf("Gagal sinkronisasi Guru (GTK): %v", err))
		} else {
			hasSuccess = true
			summary.Summary["gtk"] = stat
			summary.Details = append(summary.Details, details...)
		}
	}

	// 2. SYNC ROMBEL & WALI KELAS
	if opts.SyncRombel {
		stat, details, err := s.syncRombel(db, opts.DryRun, opts.PreserveManualOverrides)
		if err != nil {
			hasError = true
			log.Printf("Error syncing Rombel: %v", err)
			summary.Details = append(summary.Details, fmt.Sprintf("Gagal sinkronisasi Rombel: %v", err))
		} else {
			hasSuccess = true
			summary.Summary["rombel"] = stat
			summary.Details = append(summary.Details, details...)
		}
	}

	// 3. SYNC PESERTA DIDIK (SISWA)
	if opts.SyncSiswa {
		stat, details, err := s.syncSiswa(db, opts.DryRun, opts.PreserveManualOverrides)
		if err != nil {
			hasError = true
			log.Printf("Error syncing Siswa: %v", err)
			summary.Details = append(summary.Details, fmt.Sprintf("Gagal sinkronisasi Siswa: %v", err))
		} else {
			hasSuccess = true
			summary.Summary["siswa"] = stat
			summary.Details = append(summary.Details, details...)
		}
	}

	// 4. SYNC PEMBELAJARAN (MAPEL + PENUGASAN GURU)
	if opts.SyncPembelajaran {
		mapelStat, penugasanStat, details, err := s.syncPembelajaran(db, opts.DryRun, opts.PreserveManualOverrides)
		if err != nil {
			hasError = true
			log.Printf("Error syncing Pembelajaran: %v", err)
			summary.Details = append(summary.Details, fmt.Sprintf("Gagal sinkronisasi Pembelajaran: %v", err))
		} else {
			hasSuccess = true
			summary.Summary["mapel"] = mapelStat
			summary.Summary["penugasan"] = penugasanStat
			summary.Details = append(summary.Details, details...)
		}
	}

	if hasError && !hasSuccess {
		summary.Status = "error"
	} else if hasError && hasSuccess {
		summary.Status = "partial"
	}

	summary.MockDataDetected = s.mockDataDetected
	summary.DurationMs = time.Since(startTime).Milliseconds()

	// Invalidate Redis caches
	if config.RDB != nil && !opts.DryRun {
		_ = config.RDB.Del(config.RedisCtx, "dashboard:stats", "master:rombels", "master:subjects", "master:teachers", "master:students").Err()
	}

	return summary, nil
}

func (s *DapodikService) syncGTK(db *gorm.DB, dryRun bool, preserveManual bool) (SyncCategoryStat, []string, error) {
	stat := SyncCategoryStat{}
	var details []string

	data, err := s.fetch("getGtk")
	if err != nil {
		return stat, details, err
	}

	gtks, err := parseDapodikArray(data)
	if err != nil {
		return stat, details, err
	}

	// Pre-fetch existing users
	var existingUsers []models.User
	db.Find(&existingUsers)
	userByDapodikID := make(map[string]*models.User)
	userByEmail := make(map[string]*models.User)
	userByNip := make(map[string]*models.User)
	for i := range existingUsers {
		u := &existingUsers[i]
		if u.DapodikID != "" {
			userByDapodikID[u.DapodikID] = u
		}
		if u.Email != "" {
			userByEmail[strings.ToLower(u.Email)] = u
		}
		if u.NipNik != "" {
			userByNip[u.NipNik] = u
		}
	}

	type newGtkJob struct {
		user models.User
		raw  string
	}
	var newUsers []newGtkJob
	var usersToUpdate []models.User

	now := time.Now()

	for _, g := range gtks {
		ptkID, _ := g["ptk_id"].(string)
		nama, _ := g["nama"].(string)
		nip, _ := g["nip"].(string)
		nik, _ := g["nik"].(string)
		email, _ := g["email"].(string)
		hp, _ := g["no_hp"].(string)

		if ptkID == "" || nama == "" {
			continue
		}

		nipNik := nip
		if nipNik == "" {
			nipNik = nik
		}

		hash := computeDataHash(ptkID, nama, email, hp, nipNik)

		// Check if user already exists
		existing, exists := userByDapodikID[ptkID]
		if !exists && nipNik != "" {
			existing, exists = userByNip[nipNik]
		}

		if exists {
			if existing.IsManualOverride && preserveManual {
				stat.Skipped++
				details = append(details, fmt.Sprintf("Guru '%s' dilewati (data dikelola manual)", existing.Name))
				continue
			}
			if existing.DapodikDataHash == hash {
				stat.Skipped++
				continue
			}

			// Changed
			changes := []string{}
			if existing.Name != nama {
				changes = append(changes, fmt.Sprintf("Nama '%s' -> '%s'", existing.Name, nama))
				existing.Name = nama
			}
			if nipNik != "" && existing.NipNik != nipNik {
				changes = append(changes, fmt.Sprintf("NIP/NIK '%s' -> '%s'", existing.NipNik, nipNik))
				existing.NipNik = nipNik
			}
			if hp != "" && existing.Phone != hp {
				changes = append(changes, fmt.Sprintf("No HP diperbarui"))
				existing.Phone = hp
			}
			existing.DapodikDataHash = hash
			existing.DapodikLastSyncedAt = &now
			existing.UpdatedAt = now

			usersToUpdate = append(usersToUpdate, *existing)
			stat.Updated++
			details = append(details, fmt.Sprintf("Guru '%s' diperbarui (%s)", nama, strings.Join(changes, ", ")))
		} else {
			// New user
			if email == "" {
				cleanName := strings.ToLower(strings.ReplaceAll(nama, " ", "."))
				email = fmt.Sprintf("%s@smk.sch.id", cleanName)
			}
			// Collision resolve
			baseEmail := email
			counter := 1
			for {
				if _, ok := userByEmail[strings.ToLower(email)]; !ok {
					break
				}
				parts := strings.Split(baseEmail, "@")
				email = fmt.Sprintf("%s%d@%s", parts[0], counter, parts[1])
				counter++
			}

			rawPassword := nipNik
			if rawPassword == "" {
				rawPassword = "guru" + ptkID
			}

			newUser := models.User{
				ID:                  ptkID,
				Name:                nama,
				Email:               email,
				Role:                models.RoleGuru,
				NipNik:              nipNik,
				Phone:               hp,
				DapodikID:           ptkID,
				DapodikDataHash:     hash,
				DapodikLastSyncedAt: &now,
				IsInitialPassword:   true,
				CreatedAt:           now,
				UpdatedAt:           now,
			}

			userByEmail[strings.ToLower(email)] = &newUser
			if nipNik != "" {
				userByNip[nipNik] = &newUser
			}
			userByDapodikID[ptkID] = &newUser

			newUsers = append(newUsers, newGtkJob{user: newUser, raw: rawPassword})
			stat.Created++
			details = append(details, fmt.Sprintf("Guru '%s' ditambahkan", nama))
		}
	}

	if dryRun {
		return stat, details, nil
	}

	// Parallel bcrypt hashing for new users
	numWorkers := runtime.NumCPU()
	if numWorkers < 2 {
		numWorkers = 2
	}
	hashChan := make(chan int, len(newUsers))
	var wg sync.WaitGroup

	for i := 0; i < len(newUsers); i++ {
		hashChan <- i
	}
	close(hashChan)

	for w := 0; w < numWorkers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for idx := range hashChan {
				h, err := bcrypt.GenerateFromPassword([]byte(newUsers[idx].raw), bcrypt.DefaultCost)
				if err == nil {
					newUsers[idx].user.PasswordHash = string(h)
				} else {
					newUsers[idx].user.PasswordHash = "unusable_password_hash"
				}
			}
		}()
	}
	wg.Wait()

	// Batch insert & update in transaction
	err = db.Transaction(func(tx *gorm.DB) error {
		if len(newUsers) > 0 {
			toInsert := make([]models.User, len(newUsers))
			for i := range newUsers {
				toInsert[i] = newUsers[i].user
			}
			if err := tx.CreateInBatches(toInsert, 100).Error; err != nil {
				return err
			}
		}

		for _, u := range usersToUpdate {
			if err := tx.Save(&u).Error; err != nil {
				return err
			}
		}

		return nil
	})

	return stat, details, err
}

func (s *DapodikService) syncRombel(db *gorm.DB, dryRun bool, preserveManual bool) (SyncCategoryStat, []string, error) {
	stat := SyncCategoryStat{}
	var details []string

	data, err := s.fetch("getRombonganBelajar")
	if err != nil {
		return stat, details, err
	}

	rombels, err := parseDapodikArray(data)
	if err != nil {
		return stat, details, err
	}

	var existingRombels []models.Rombel
	db.Find(&existingRombels)
	rombelByID := make(map[string]*models.Rombel)
	for i := range existingRombels {
		rombelByID[existingRombels[i].ID] = &existingRombels[i]
	}

	var toCreate []models.Rombel
	var toUpdate []models.Rombel
	now := time.Now()

	for _, r := range rombels {
		rombelID, _ := r["rombongan_belajar_id"].(string)
		nama, _ := r["nama"].(string)
		ptkID, _ := r["ptk_id"].(string) // wali kelas

		var tingkat int
		if t, ok := r["tingkat_pendidikan_id"].(float64); ok {
			tingkat = int(t)
		} else if tStr, ok := r["tingkat_pendidikan_id"].(string); ok {
			tingkat, _ = strconv.Atoi(tStr)
		}
		if tingkat == 0 {
			tingkat = parseTingkatFromName(nama)
		}

		if rombelID == "" || nama == "" {
			continue
		}

		hash := computeDataHash(rombelID, nama, strconv.Itoa(tingkat), ptkID)

		if existing, exists := rombelByID[rombelID]; exists {
			if existing.IsManualOverride && preserveManual {
				stat.Skipped++
				details = append(details, fmt.Sprintf("Rombel '%s' dilewati (Wali Kelas/Data dikelola manual)", existing.Name))
				continue
			}
			if existing.DapodikDataHash == hash {
				stat.Skipped++
				continue
			}

			changes := []string{}
			if existing.Name != nama {
				changes = append(changes, fmt.Sprintf("Nama '%s' -> '%s'", existing.Name, nama))
				existing.Name = nama
			}
			if existing.WaliKelasID != ptkID {
				changes = append(changes, fmt.Sprintf("Wali Kelas diperbarui"))
				existing.WaliKelasID = ptkID
			}
			if existing.Tingkat != tingkat {
				existing.Tingkat = tingkat
			}
			existing.DapodikDataHash = hash
			existing.UpdatedAt = now

			toUpdate = append(toUpdate, *existing)
			stat.Updated++
			details = append(details, fmt.Sprintf("Rombel '%s' diperbarui (%s)", nama, strings.Join(changes, ", ")))
		} else {
			newRombel := models.Rombel{
				ID:              rombelID,
				Name:            nama,
				Tingkat:         tingkat,
				WaliKelasID:     ptkID,
				DapodikDataHash: hash,
				CreatedAt:       now,
				UpdatedAt:       now,
			}
			toCreate = append(toCreate, newRombel)
			stat.Created++
			details = append(details, fmt.Sprintf("Rombel '%s' ditambahkan", nama))
		}
	}

	if dryRun {
		return stat, details, nil
	}

	err = db.Transaction(func(tx *gorm.DB) error {
		if len(toCreate) > 0 {
			if err := tx.CreateInBatches(toCreate, 100).Error; err != nil {
				return err
			}
		}
		for _, r := range toUpdate {
			if err := tx.Save(&r).Error; err != nil {
				return err
			}
		}
		return nil
	})

	return stat, details, err
}

func (s *DapodikService) syncSiswa(db *gorm.DB, dryRun bool, preserveManual bool) (SyncCategoryStat, []string, error) {
	stat := SyncCategoryStat{}
	var details []string

	data, err := s.fetch("getPesertaDidik")
	if err != nil {
		return stat, details, err
	}

	pds, err := parseDapodikArray(data)
	if err != nil {
		return stat, details, err
	}

	var existingStudents []models.Student
	db.Find(&existingStudents)
	studentByID := make(map[string]*models.Student)
	for i := range existingStudents {
		studentByID[existingStudents[i].ID] = &existingStudents[i]
	}

	var toCreate []models.Student
	var toUpdate []models.Student
	now := time.Now()

	for _, p := range pds {
		pdID, _ := p["peserta_didik_id"].(string)
		nama, _ := p["nama"].(string)
		nisn, _ := p["nisn"].(string)
		nis, _ := p["nis"].(string)
		rombelID, _ := p["rombongan_belajar_id"].(string)
		jk, _ := p["jenis_kelamin"].(string)
		tempatLahir, _ := p["tempat_lahir"].(string)
		tglLahir, _ := p["tanggal_lahir"].(string)
		if tglLahir == "" {
			tglLahir, _ = p["tgl_lahir"].(string)
		}

		if pdID == "" || nama == "" {
			continue
		}

		hash := computeDataHash(pdID, nama, nisn, rombelID, jk, tglLahir)

		if existing, exists := studentByID[pdID]; exists {
			if existing.IsManualOverride && preserveManual {
				stat.Skipped++
				details = append(details, fmt.Sprintf("Siswa '%s' dilewati (identitas/kelas dikelola manual)", existing.Name))
				continue
			}
			if existing.DapodikDataHash == hash {
				stat.Skipped++
				continue
			}

			changes := []string{}
			if existing.Name != nama {
				changes = append(changes, fmt.Sprintf("Nama '%s' -> '%s'", existing.Name, nama))
				existing.Name = nama
			}
			if existing.RombelID != rombelID {
				changes = append(changes, fmt.Sprintf("Pindah Rombel"))
				existing.RombelID = rombelID
			}
			if existing.Nisn != nisn {
				existing.Nisn = nisn
			}
			existing.JenisKelamin = jk
			existing.TanggalLahir = tglLahir
			existing.TempatLahir = tempatLahir
			existing.DapodikDataHash = hash
			existing.DapodikLastSyncedAt = &now
			existing.UpdatedAt = now

			toUpdate = append(toUpdate, *existing)
			stat.Updated++
			details = append(details, fmt.Sprintf("Siswa '%s' diperbarui (%s)", nama, strings.Join(changes, ", ")))
		} else {
			newStudent := models.Student{
				ID:                  pdID,
				Name:                nama,
				Nisn:                nisn,
				Nis:                 nis,
				RombelID:            rombelID,
				JenisKelamin:        jk,
				TempatLahir:         tempatLahir,
				TanggalLahir:        tglLahir,
				DapodikID:           pdID,
				DapodikDataHash:     hash,
				DapodikLastSyncedAt: &now,
				CreatedAt:           now,
				UpdatedAt:           now,
			}
			toCreate = append(toCreate, newStudent)
			stat.Created++
			details = append(details, fmt.Sprintf("Siswa '%s' ditambahkan ke rombel", nama))
		}
	}

	if dryRun {
		return stat, details, nil
	}

	err = db.Transaction(func(tx *gorm.DB) error {
		if len(toCreate) > 0 {
			if err := tx.CreateInBatches(toCreate, 100).Error; err != nil {
				return err
			}
		}
		for _, s := range toUpdate {
			if err := tx.Save(&s).Error; err != nil {
				return err
			}
		}
		return nil
	})

	return stat, details, err
}

func (s *DapodikService) syncPembelajaran(db *gorm.DB, dryRun bool, preserveManual bool) (SyncCategoryStat, SyncCategoryStat, []string, error) {
	mapelStat := SyncCategoryStat{}
	penugasanStat := SyncCategoryStat{}
	var details []string

	data, err := s.fetch("getPembelajaran")
	if err != nil {
		log.Printf("Info: Endpoint getPembelajaran dilewati: %v", err)
		details = append(details, "Endpoint getPembelajaran tidak tersedia pada server Dapodik (sinkronisasi mapel & penugasan dilewati)")
		return mapelStat, penugasanStat, details, nil
	}

	pembelajarans, err := parseDapodikArray(data)
	if err != nil {
		return mapelStat, penugasanStat, details, err
	}

	// 1. Process Unique Subjects
	var existingSubjects []models.Subject
	db.Find(&existingSubjects)
	subjectByMapelID := make(map[int]*models.Subject)
	for i := range existingSubjects {
		if existingSubjects[i].DapodikMapelID > 0 {
			subjectByMapelID[existingSubjects[i].DapodikMapelID] = &existingSubjects[i]
		}
	}

	var subjectsToCreate []models.Subject
	var subjectsToUpdate []models.Subject
	now := time.Now()

	for _, p := range pembelajarans {
		var mapelID int
		if m, ok := p["mata_pelajaran_id"].(float64); ok {
			mapelID = int(m)
		} else if mStr, ok := p["mata_pelajaran_id"].(string); ok {
			mapelID, _ = strconv.Atoi(mStr)
		}

		namaMapel, _ := p["nama_mata_pelajaran"].(string)
		if namaMapel == "" {
			namaMapel, _ = p["nama"].(string)
		}
		if mapelID == 0 || namaMapel == "" {
			continue
		}

		kelompok, _ := p["status_di_kurikulum"].(string)
		hash := computeDataHash(strconv.Itoa(mapelID), namaMapel, kelompok)

		if existing, exists := subjectByMapelID[mapelID]; exists {
			// Smart Sync: Protect manual overrides
			if preserveManual && existing.IsManualOverride {
				mapelStat.Skipped++
				continue
			}
			if existing.DapodikDataHash == hash {
				mapelStat.Skipped++
				continue
			}
			existing.Nama = namaMapel
			existing.Kelompok = kelompok
			existing.DapodikDataHash = hash
			existing.UpdatedAt = now
			subjectsToUpdate = append(subjectsToUpdate, *existing)
			mapelStat.Updated++
			details = append(details, fmt.Sprintf("Mata Pelajaran '%s' diperbarui", namaMapel))
		} else {
			newSub := models.Subject{
				ID:              uuid.NewString(),
				DapodikMapelID:  mapelID,
				Nama:            namaMapel,
				Kelompok:        kelompok,
				DapodikDataHash: hash,
				CreatedAt:       now,
				UpdatedAt:       now,
			}
			subjectByMapelID[mapelID] = &newSub
			subjectsToCreate = append(subjectsToCreate, newSub)
			mapelStat.Created++
			details = append(details, fmt.Sprintf("Mata Pelajaran '%s' ditambahkan", namaMapel))
		}
	}

	if !dryRun {
		_ = db.Transaction(func(tx *gorm.DB) error {
			if len(subjectsToCreate) > 0 {
				if err := tx.CreateInBatches(subjectsToCreate, 100).Error; err != nil {
					return err
				}
			}
			for _, s := range subjectsToUpdate {
				if err := tx.Save(&s).Error; err != nil {
					return err
				}
			}
			return nil
		})
	}

	// Reload subjects map to have valid IDs
	var allSubjects []models.Subject
	db.Find(&allSubjects)
	mapelIdToSubjectID := make(map[int]string)
	for _, s := range allSubjects {
		if s.DapodikMapelID > 0 {
			mapelIdToSubjectID[s.DapodikMapelID] = s.ID
		}
	}

	// 2. Process Teaching Assignments
	var existingAssignments []models.TeachingAssignment
	db.Find(&existingAssignments)
	assignmentByKey := make(map[string]*models.TeachingAssignment)
	for i := range existingAssignments {
		key := fmt.Sprintf("%s_%s_%s", existingAssignments[i].GuruID, existingAssignments[i].SubjectID, existingAssignments[i].RombelID)
		assignmentByKey[key] = &existingAssignments[i]
	}

	var assignmentsToCreate []models.TeachingAssignment
	var assignmentsToUpdate []models.TeachingAssignment

	for _, p := range pembelajarans {
		pembelajaranID, _ := p["pembelajaran_id"].(string)
		ptkID, _ := p["ptk_id"].(string)
		rombelID, _ := p["rombongan_belajar_id"].(string)

		var mapelID int
		if m, ok := p["mata_pelajaran_id"].(float64); ok {
			mapelID = int(m)
		} else if mStr, ok := p["mata_pelajaran_id"].(string); ok {
			mapelID, _ = strconv.Atoi(mStr)
		}

		var jam int
		if j, ok := p["jam_mengajar_per_minggu"].(float64); ok {
			jam = int(j)
		}

		subjectID := mapelIdToSubjectID[mapelID]
		if ptkID == "" || rombelID == "" || subjectID == "" {
			continue
		}

		key := fmt.Sprintf("%s_%s_%s", ptkID, subjectID, rombelID)
		hash := computeDataHash(pembelajaranID, ptkID, subjectID, rombelID, strconv.Itoa(jam))

		if existing, exists := assignmentByKey[key]; exists {
			if existing.IsManualOverride && preserveManual {
				penugasanStat.Skipped++
				continue
			}
			if existing.DapodikDataHash == hash {
				penugasanStat.Skipped++
				continue
			}
			existing.JamPerMinggu = jam
			existing.DapodikPembelajaranID = pembelajaranID
			existing.DapodikDataHash = hash
			existing.UpdatedAt = now
			assignmentsToUpdate = append(assignmentsToUpdate, *existing)
			penugasanStat.Updated++
		} else {
			newAssign := models.TeachingAssignment{
				ID:                    uuid.NewString(),
				GuruID:                ptkID,
				SubjectID:             subjectID,
				RombelID:              rombelID,
				DapodikPembelajaranID: pembelajaranID,
				JamPerMinggu:          jam,
				DapodikDataHash:       hash,
				CreatedAt:             now,
				UpdatedAt:             now,
			}
			assignmentsToCreate = append(assignmentsToCreate, newAssign)
			penugasanStat.Created++
		}
	}

	if dryRun {
		return mapelStat, penugasanStat, details, nil
	}

	err = db.Transaction(func(tx *gorm.DB) error {
		if len(assignmentsToCreate) > 0 {
			if err := tx.CreateInBatches(assignmentsToCreate, 100).Error; err != nil {
				return err
			}
		}
		for _, a := range assignmentsToUpdate {
			if err := tx.Save(&a).Error; err != nil {
				return err
			}
		}
		return nil
	})

	if len(assignmentsToCreate) > 0 {
		details = append(details, fmt.Sprintf("%d penugasan guru-mapel-rombel ditambahkan", len(assignmentsToCreate)))
	}

	return mapelStat, penugasanStat, details, err
}

func parseTingkatFromName(name string) int {
	clean := strings.ToUpper(strings.TrimSpace(name))
	if strings.HasPrefix(clean, "XII ") || strings.HasPrefix(clean, "12 ") || strings.Contains(clean, "XII-") || strings.Contains(clean, "XII ") {
		return 12
	}
	if strings.HasPrefix(clean, "XI ") || strings.HasPrefix(clean, "11 ") || strings.Contains(clean, "XI-") || strings.Contains(clean, "XI ") {
		return 11
	}
	if strings.HasPrefix(clean, "X ") || strings.HasPrefix(clean, "10 ") || strings.Contains(clean, "X-") || strings.Contains(clean, "X ") {
		return 10
	}
	return 10
}

func (s *DapodikService) getMockData(endpoint string) ([]byte, error) {
	switch endpoint {
	case "getSekolah":
		sekolah := map[string]interface{}{
			"sekolah_id": "sekolah-smk-alazhar",
			"nama":       "SMK Al-Azhar Sempu",
			"npsn":       s.NPSN,
		}
		return json.Marshal(sekolah)

	case "getGtk":
		gtks := []map[string]interface{}{
			{
				"ptk_id": "guru-1",
				"nama":   "Pak Ahmad Fauzi, S.Pd.",
				"nip":    "198001012005011001",
				"nik":    "3578010101800001",
				"no_hp":  "081234567890",
				"email":  "ahmad.fauzi@smk.sch.id",
			},
			{
				"ptk_id": "guru-2",
				"nama":   "Bu Siti Nurhaliza, M.Kom.",
				"nip":    "198205022008012002",
				"nik":    "3578010205820002",
				"no_hp":  "081234567891",
				"email":  "siti.nurhaliza@smk.sch.id",
			},
			{
				"ptk_id": "guru-3",
				"nama":   "Pak Budi Santoso, S.T.",
				"nip":    "197812122003011003",
				"nik":    "3578011212780003",
				"no_hp":  "081234567892",
				"email":  "budi.santoso@smk.sch.id",
			},
			{
				"ptk_id": "guru-4",
				"nama":   "Ferdian Nada, S.Kom.",
				"nip":    "199005152019011004",
				"nik":    "3578011505900004",
				"no_hp":  "081234567893",
				"email":  "ferdian.nada@smk.sch.id",
			},
		}
		return json.Marshal(gtks)

	case "getRombonganBelajar":
		rombels := []map[string]interface{}{
			{
				"rombongan_belajar_id":  "rombel-x-rpl-1",
				"nama":                  "X RPL 1",
				"ptk_id":                "guru-3",
				"tingkat_pendidikan_id": 10,
			},
			{
				"rombongan_belajar_id":  "rombel-xi-rpl-1",
				"nama":                  "XI RPL 1",
				"ptk_id":                "guru-1",
				"tingkat_pendidikan_id": 11,
			},
			{
				"rombongan_belajar_id":  "rombel-xii-rpl-1",
				"nama":                  "XII RPL 1",
				"ptk_id":                "guru-2",
				"tingkat_pendidikan_id": 12,
			},
		}
		return json.Marshal(rombels)

	case "getPesertaDidik":
		pds := []map[string]interface{}{
			{
				"peserta_didik_id":     "siswa-1",
				"nama":                 "Rina Sari",
				"nisn":                 "0051234561",
				"nis":                  "2223101",
				"jenis_kelamin":        "P",
				"tempat_lahir":         "Banyuwangi",
				"tanggal_lahir":        "2007-04-12",
				"rombongan_belajar_id": "rombel-xi-rpl-1",
			},
			{
				"peserta_didik_id":     "siswa-2",
				"nama":                 "Budi Pratama",
				"nisn":                 "0051234562",
				"nis":                  "2223102",
				"jenis_kelamin":        "L",
				"tempat_lahir":         "Jember",
				"tanggal_lahir":        "2007-06-20",
				"rombongan_belajar_id": "rombel-xi-rpl-1",
			},
			{
				"peserta_didik_id":     "siswa-3",
				"nama":                 "Dewi Anggraeni",
				"nisn":                 "0051234563",
				"nis":                  "2223103",
				"jenis_kelamin":        "P",
				"tempat_lahir":         "Banyuwangi",
				"tanggal_lahir":        "2007-08-15",
				"rombongan_belajar_id": "rombel-xi-rpl-1",
			},
			{
				"peserta_didik_id":     "siswa-4",
				"nama":                 "Andi Setiawan",
				"nisn":                 "0051234564",
				"nis":                  "2223104",
				"jenis_kelamin":        "L",
				"tempat_lahir":         "Banyuwangi",
				"tanggal_lahir":        "2006-11-05",
				"rombongan_belajar_id": "rombel-xii-rpl-1",
			},
			{
				"peserta_didik_id":     "siswa-5",
				"nama":                 "Fitri Handayani",
				"nisn":                 "0051234565",
				"nis":                  "2223105",
				"jenis_kelamin":        "P",
				"tempat_lahir":         "Surabaya",
				"tanggal_lahir":        "2006-03-25",
				"rombongan_belajar_id": "rombel-xii-rpl-1",
			},
			{
				"peserta_didik_id":     "siswa-6",
				"nama":                 "Dimas Arya",
				"nisn":                 "0051234566",
				"nis":                  "2324101",
				"jenis_kelamin":        "L",
				"tempat_lahir":         "Banyuwangi",
				"tanggal_lahir":        "2008-01-10",
				"rombongan_belajar_id": "rombel-x-rpl-1",
			},
		}
		return json.Marshal(pds)

	case "getPembelajaran":
		pemb := []map[string]interface{}{
			{
				"pembelajaran_id":         "pemb-1",
				"rombongan_belajar_id":    "rombel-xi-rpl-1",
				"ptk_id":                  "guru-1",
				"mata_pelajaran_id":       101,
				"nama_mata_pelajaran":     "Pendidikan Agama Islam",
				"status_di_kurikulum":     "A",
				"jam_mengajar_per_minggu": 3,
			},
			{
				"pembelajaran_id":         "pemb-2",
				"rombongan_belajar_id":    "rombel-xi-rpl-1",
				"ptk_id":                  "guru-2",
				"mata_pelajaran_id":       102,
				"nama_mata_pelajaran":     "Bahasa Indonesia",
				"status_di_kurikulum":     "A",
				"jam_mengajar_per_minggu": 3,
			},
			{
				"pembelajaran_id":         "pemb-3",
				"rombongan_belajar_id":    "rombel-xi-rpl-1",
				"ptk_id":                  "guru-4",
				"mata_pelajaran_id":       201,
				"nama_mata_pelajaran":     "Pemrograman Web dan Perangkat Bergerak",
				"status_di_kurikulum":     "B",
				"jam_mengajar_per_minggu": 6,
			},
			{
				"pembelajaran_id":         "pemb-4",
				"rombongan_belajar_id":    "rombel-xi-rpl-1",
				"ptk_id":                  "guru-3",
				"mata_pelajaran_id":       202,
				"nama_mata_pelajaran":     "Basis Data",
				"status_di_kurikulum":     "B",
				"jam_mengajar_per_minggu": 4,
			},
			{
				"pembelajaran_id":         "pemb-5",
				"rombongan_belajar_id":    "rombel-xii-rpl-1",
				"ptk_id":                  "guru-4",
				"mata_pelajaran_id":       201,
				"nama_mata_pelajaran":     "Pemrograman Web dan Perangkat Bergerak",
				"status_di_kurikulum":     "B",
				"jam_mengajar_per_minggu": 6,
			},
		}
		return json.Marshal(pemb)
	}

	return nil, fmt.Errorf("unknown endpoint %s", endpoint)
}
