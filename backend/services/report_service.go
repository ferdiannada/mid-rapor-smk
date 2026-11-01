package services

import (
	"archive/zip"
	"bytes"
	"context"
	"fmt"
	"html/template"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"gorm.io/gorm"
	"rapor-smk-backend/config"
	"rapor-smk-backend/models"
)

type StudentReportData struct {
	SekolahNama      string                         `json:"sekolah_nama"`
	SekolahNPSN      string                         `json:"sekolah_npsn"`
	SekolahNSS       string                         `json:"sekolah_nss"`
	SekolahAlamat    string                         `json:"sekolah_alamat"`
	SekolahKelurahan string                         `json:"sekolah_kelurahan"`
	SekolahKecamatan string                         `json:"sekolah_kecamatan"`
	SekolahKabupaten string                         `json:"sekolah_kabupaten"`
	SekolahProvinsi  string                         `json:"sekolah_provinsi"`
	SekolahKodePos   string                         `json:"sekolah_kode_pos"`
	SekolahTelepon   string                         `json:"sekolah_telepon"`
	SekolahEmail     string                         `json:"sekolah_email"`
	SekolahWebsite   string                         `json:"sekolah_website"`
	KopBaris1        string                         `json:"kop_baris_1"`
	KopBaris2        string                         `json:"kop_baris_2"`
	KopBaris3        string                         `json:"kop_baris_3"`
	LogoKiri         string                         `json:"logo_kiri"`
	LogoKanan        string                         `json:"logo_kanan"`
	TahunAjaran      string                         `json:"tahun_ajaran"`
	Semester         string                         `json:"semester"`
	JenisRapor       string                         `json:"jenis_rapor"`
	Fase             string                         `json:"fase"`
	Kelas            string                         `json:"kelas"`
	Student          models.Student                 `json:"student"`
	WaliKelasNama    string                         `json:"wali_kelas_nama"`
	WaliKelasNIP     string                         `json:"wali_kelas_nip"`
	KepsekNama       string                         `json:"kepsek_nama"`
	KepsekNIP        string                         `json:"kepsek_nip"`
	TanggalCetak     string                         `json:"tanggal_cetak"`
	KotaSekolah      string                         `json:"kota_sekolah"`
	Grades           []ReportSubjectGrade           `json:"grades"`
	GroupedGrades    []ReportGradeGroup             `json:"grouped_grades"`
	Attendance       *models.Attendance             `json:"attendance"`
	Extracurricular  []models.Extracurricular       `json:"extracurricular"`
	WaliNote         *models.WaliKelasNote          `json:"wali_note"`
}

type ReportGradeGroup struct {
	KodeKelompok string               `json:"kode_kelompok"`
	NamaKelompok string               `json:"nama_kelompok"`
	Grades       []ReportSubjectGrade `json:"grades"`
}

type ReportSubjectGrade struct {
	No               int     `json:"no"`
	SubjectID        string  `json:"subject_id"`
	SubjectNama      string  `json:"subject_nama"`
	Kelompok         string  `json:"kelompok"`
	Urutan           int     `json:"urutan"`
	GuruNama         string  `json:"guru_nama"`
	NilaiAkhir       float64 `json:"nilai_akhir"`
	DeskripsiCapaian string  `json:"deskripsi_capaian"`
}

type GradeProgressItem struct {
	RombelID         string  `json:"rombel_id"`
	RombelName       string  `json:"rombel_name"`
	SubjectID        string  `json:"subject_id"`
	SubjectName      string  `json:"subject_name"`
	GuruName         string  `json:"guru_name"`
	TotalStudents    int     `json:"total_students"`
	GradedStudents   int     `json:"graded_students"`
	Percentage       float64 `json:"percentage"`
	IsComplete       bool    `json:"is_complete"`
}

type ReportService struct{}

func NewReportService() *ReportService {
	return &ReportService{}
}

func FormatKelompokTitle(k string) string {
	kClean := strings.ToUpper(strings.TrimSpace(k))
	switch kClean {
	case "A":
		return "A. Kelompok Mata Pelajaran Umum"
	case "B":
		return "B. Kelompok Mata Pelajaran Kejuruan"
	case "C":
		return "C. Kelompok Konsentrasi Keahlian"
	case "MUATAN LOKAL", "MULOK":
		return "Muatan Lokal"
	default:
		if kClean == "" {
			return "Mata Pelajaran Umum / Lainnya"
		}
		return "Kelompok " + k
	}
}

func GroupGradesByKelompok(grades []ReportSubjectGrade, cachedGroups ...[]models.SubjectGroup) ([]ReportGradeGroup, []ReportSubjectGrade) {
	groupOrder := []string{"A", "B", "C", "Muatan Lokal"}
	titleMap := make(map[string]string)

	var sGroups []models.SubjectGroup
	if len(cachedGroups) > 0 && len(cachedGroups[0]) > 0 {
		sGroups = cachedGroups[0]
	} else if config.DB != nil {
		_ = config.DB.Order("urutan ASC, kode ASC").Find(&sGroups).Error
	}

	if len(sGroups) > 0 {
		groupOrder = make([]string, 0, len(sGroups))
		for _, sg := range sGroups {
			groupOrder = append(groupOrder, sg.Kode)
			titleMap[strings.ToUpper(strings.TrimSpace(sg.Kode))] = sg.Nama
		}
	}

	groupMap := make(map[string][]ReportSubjectGrade)

	for _, g := range grades {
		k := strings.TrimSpace(g.Kelompok)
		if k == "" {
			k = "A"
		}
		normalized := k
		for _, goKey := range groupOrder {
			if strings.EqualFold(goKey, k) {
				normalized = goKey
				break
			}
		}
		groupMap[normalized] = append(groupMap[normalized], g)
	}

	allKeys := make([]string, 0, len(groupOrder))
	for _, goKey := range groupOrder {
		if len(groupMap[goKey]) > 0 {
			allKeys = append(allKeys, goKey)
		}
	}
	for k := range groupMap {
		found := false
		for _, ek := range allKeys {
			if ek == k {
				found = true
				break
			}
		}
		if !found {
			allKeys = append(allKeys, k)
		}
	}

	grouped := make([]ReportGradeGroup, 0, len(allKeys))
	flatSorted := make([]ReportSubjectGrade, 0, len(grades))
	sequentialNo := 1

	for _, key := range allKeys {
		items := groupMap[key]

		// Urutkan mapel dalam kelompok berdasarkan urutan ASC, lalu abjad SubjectNama ASC
		sort.SliceStable(items, func(i, j int) bool {
			if items[i].Urutan != items[j].Urutan {
				return items[i].Urutan < items[j].Urutan
			}
			return items[i].SubjectNama < items[j].SubjectNama
		})

		updatedItems := make([]ReportSubjectGrade, len(items))
		for i, it := range items {
			it.No = sequentialNo
			updatedItems[i] = it
			flatSorted = append(flatSorted, it)
			sequentialNo++
		}

		groupTitle := titleMap[strings.ToUpper(strings.TrimSpace(key))]
		if groupTitle == "" {
			groupTitle = FormatKelompokTitle(key)
		}

		grouped = append(grouped, ReportGradeGroup{
			KodeKelompok: key,
			NamaKelompok: groupTitle,
			Grades:       updatedItems,
		})
	}

	return grouped, flatSorted
}

// GetStudentReportData gathers all components of a student report
func (s *ReportService) GetStudentReportData(db *gorm.DB, studentID string, semesterID string) (*StudentReportData, error) {
	// 1. Get Semester
	var sem models.Semester
	if semesterID != "" {
		if err := db.Where("id = ?", semesterID).First(&sem).Error; err != nil {
			return nil, fmt.Errorf("semester tidak ditemukan: %w", err)
		}
	} else {
		if err := db.Where("is_active = true").First(&sem).Error; err != nil {
			return nil, fmt.Errorf("semester aktif tidak ditemukan: %w", err)
		}
	}

	// 2. Get Student with Rombel
	var student models.Student
	if err := db.Preload("Rombel.WaliKelas").Where("id = ?", studentID).First(&student).Error; err != nil {
		return nil, fmt.Errorf("siswa tidak ditemukan: %w", err)
	}

	rombel := student.Rombel
	if rombel == nil {
		return nil, fmt.Errorf("rombel siswa tidak valid")
	}

	// 3. Get School Profile (Identitas Sekolah)
	var schoolProfile models.SchoolProfile
	hasSchoolProfile := false
	if err := db.Order("updated_at DESC").First(&schoolProfile).Error; err == nil && schoolProfile.ID != "" {
		hasSchoolProfile = true
	}

	// 4. Get School Config (Dapodik Config)
	var dConfig models.DapodikConfig
	db.Where("is_active = true").First(&dConfig)

	// 5. Get Principal (Admin)
	var kepsek models.User
	db.Where("role = ?", models.RoleAdmin).First(&kepsek)

	// Determine Fase: Tingkat 10 = Fase E, Tingkat 11-12 = Fase F
	fase := "Fase F"
	if rombel.Tingkat == 10 {
		fase = "Fase E"
	}

	semesterText := "1 (Ganjil)"
	if sem.Semester == 2 {
		semesterText = "2 (Genap)"
	}

	// 6. Get all Teaching Assignments in this rombel (to discover subjects)
	var assignments []models.TeachingAssignment
	db.Preload("Subject").Preload("Guru").
		Where("rombel_id = ?", rombel.ID).
		Find(&assignments)

	// 7. Get student's grades
	var grades []models.Grade
	db.Where("student_id = ? AND semester_id = ?", student.ID, sem.ID).Find(&grades)
	gradeMap := make(map[string]models.Grade)
	for _, g := range grades {
		gradeMap[g.SubjectID] = g
	}

	// Map subjects and grades
	reportGrades := make([]ReportSubjectGrade, 0)
	seenSubjects := make(map[string]bool)
	idx := 1

	for _, a := range assignments {
		if a.Subject != nil && !seenSubjects[a.Subject.ID] {
			seenSubjects[a.Subject.ID] = true
			guruName := ""
			if a.Guru != nil {
				guruName = a.Guru.Name
			}

			item := ReportSubjectGrade{
				No:          idx,
				SubjectID:   a.Subject.ID,
				SubjectNama: a.Subject.Nama,
				Kelompok:    a.Subject.Kelompok,
				Urutan:      a.Subject.Urutan,
				GuruNama:    guruName,
			}

			if g, exists := gradeMap[a.Subject.ID]; exists {
				item.NilaiAkhir = g.NilaiAkhir
				item.DeskripsiCapaian = g.DeskripsiCapaian
			} else {
				item.NilaiAkhir = 0
				item.DeskripsiCapaian = "Belum dilakukan penilaian capaian pembelajaran."
			}

			reportGrades = append(reportGrades, item)
			idx++
		}
	}

	// 8. Get Attendance
	var att models.Attendance
	db.Where("student_id = ? AND semester_id = ?", student.ID, sem.ID).First(&att)

	// 9. Get Extracurriculars
	ekskul := make([]models.Extracurricular, 0)
	db.Where("student_id = ? AND semester_id = ?", student.ID, sem.ID).Find(&ekskul)

	// 10. Get Wali Note
	var waliNote models.WaliKelasNote
	db.Where("student_id = ? AND semester_id = ?", student.ID, sem.ID).First(&waliNote)

	waliName := "-"
	waliNIP := "-"
	if rombel.WaliKelas != nil {
		waliName = rombel.WaliKelas.Name
		if rombel.WaliKelas.NipNik != "" {
			waliNIP = rombel.WaliKelas.NipNik
		}
	}

	kepsekName := "Drs. H. Mulyadi, M.Pd."
	kepsekNIP := "196805121994031004"
	if hasSchoolProfile && schoolProfile.KepalaSekolahNama != "" {
		kepsekName = schoolProfile.KepalaSekolahNama
		if schoolProfile.KepalaSekolahNIP != "" {
			kepsekNIP = schoolProfile.KepalaSekolahNIP
		}
	} else if kepsek.Name != "" {
		kepsekName = kepsek.Name
		if kepsek.NipNik != "" {
			kepsekNIP = kepsek.NipNik
		}
	}

	npsn := "20108921"
	if hasSchoolProfile && schoolProfile.NPSN != "" {
		npsn = schoolProfile.NPSN
	} else if dConfig.Npsn != "" {
		npsn = dConfig.Npsn
	}

	sekolahNama := "SMK NEGERI 1 KOTA"
	if hasSchoolProfile && schoolProfile.NamaSekolah != "" {
		sekolahNama = schoolProfile.NamaSekolah
	}

	sekolahAlamat := "Jl. Pendidikan No. 45, Kompleks Edukasi"
	if hasSchoolProfile && schoolProfile.Alamat != "" {
		sekolahAlamat = schoolProfile.Alamat
	}

	kotaSekolah := "Jakarta"
	if hasSchoolProfile && schoolProfile.TitimangsaTempat != "" {
		kotaSekolah = schoolProfile.TitimangsaTempat
	} else if hasSchoolProfile && schoolProfile.KabupatenKota != "" {
		kotaSekolah = schoolProfile.KabupatenKota
	}

	kopBaris1 := "PEMERINTAH PROVINSI DAERAH KHUSUS IBUKOTA JAKARTA"
	kopBaris2 := "DINAS PENDIDIKAN"
	kopBaris3 := ""
	if hasSchoolProfile {
		if schoolProfile.KopBaris1 != "" {
			kopBaris1 = schoolProfile.KopBaris1
		}
		if schoolProfile.KopBaris2 != "" {
			kopBaris2 = schoolProfile.KopBaris2
		}
		kopBaris3 = schoolProfile.KopBaris3
	}

	logoKiri := ""
	logoKanan := ""
	sekolahNSS := ""
	sekolahKelurahan := ""
	sekolahKecamatan := ""
	sekolahKabupaten := ""
	sekolahProvinsi := ""
	sekolahKodePos := ""
	sekolahTelepon := ""
	sekolahEmail := ""
	sekolahWebsite := ""
	if hasSchoolProfile {
		logoKiri = schoolProfile.LogoKiri
		logoKanan = schoolProfile.LogoKanan
		sekolahNSS = schoolProfile.NSS
		sekolahKelurahan = schoolProfile.DesaKelurahan
		sekolahKecamatan = schoolProfile.Kecamatan
		sekolahKabupaten = schoolProfile.KabupatenKota
		sekolahProvinsi = schoolProfile.Provinsi
		sekolahKodePos = schoolProfile.KodePos
		sekolahTelepon = schoolProfile.Telepon
		sekolahEmail = schoolProfile.Email
		sekolahWebsite = schoolProfile.Website
	}

	// Format tanggal cetak Indonesia
	now := time.Now()
	bulanIndo := []string{"", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"}
	tanggalCetak := fmt.Sprintf("%d %s %d", now.Day(), bulanIndo[now.Month()], now.Year())
	if hasSchoolProfile {
		if sem.JenisRapor == "mid" && schoolProfile.TanggalRaporPTS != "" {
			tanggalCetak = schoolProfile.TanggalRaporPTS
		} else if sem.JenisRapor == "akhir" && schoolProfile.TanggalRaporPAS != "" {
			tanggalCetak = schoolProfile.TanggalRaporPAS
		}
	}

	groupedGrades, sortedGrades := GroupGradesByKelompok(reportGrades)

	return &StudentReportData{
		SekolahNama:      sekolahNama,
		SekolahNPSN:      npsn,
		SekolahNSS:       sekolahNSS,
		SekolahAlamat:    sekolahAlamat,
		SekolahKelurahan: sekolahKelurahan,
		SekolahKecamatan: sekolahKecamatan,
		SekolahKabupaten: sekolahKabupaten,
		SekolahProvinsi:  sekolahProvinsi,
		SekolahKodePos:   sekolahKodePos,
		SekolahTelepon:   sekolahTelepon,
		SekolahEmail:     sekolahEmail,
		SekolahWebsite:   sekolahWebsite,
		KopBaris1:        kopBaris1,
		KopBaris2:        kopBaris2,
		KopBaris3:        kopBaris3,
		LogoKiri:         logoKiri,
		LogoKanan:        logoKanan,
		TahunAjaran:      sem.TahunAjaran,
		Semester:         semesterText,
		JenisRapor:       "Laporan Hasil Penilaian Tengah Semester (PTS / STS)",
		Fase:             fase,
		Kelas:            rombel.Name,
		Student:          student,
		WaliKelasNama:    waliName,
		WaliKelasNIP:     waliNIP,
		KepsekNama:       kepsekName,
		KepsekNIP:        kepsekNIP,
		TanggalCetak:     tanggalCetak,
		KotaSekolah:      kotaSekolah,
		Grades:           sortedGrades,
		GroupedGrades:    groupedGrades,
		Attendance:       &att,
		Extracurricular:  ekskul,
		WaliNote:         &waliNote,
	}, nil
}

// GenerateReportHTML builds the complete print-ready HTML for Kurikulum Merdeka Mid Semester
func (s *ReportService) GenerateReportHTML(data *StudentReportData) (string, error) {
	htmlTmpl := `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Rapor Mid Semester - {{.Student.Name}}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm 12mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.35;
      color: #111;
      margin: 0;
      padding: 0;
      background: #fff;
    }
    .header-kop {
      border-bottom: 3px double #000;
      padding-bottom: 8px;
      margin-bottom: 14px;
    }
    .header-kop h2 {
      margin: 0;
      font-size: 13pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      line-height: 1.25;
    }
    .header-kop h3 {
      margin: 0;
      font-size: 10.5pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      line-height: 1.2;
    }
    .header-kop h1 {
      margin: 2px 0;
      font-size: 15pt;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      line-height: 1.2;
    }
    .header-kop p {
      margin: 2px 0 0 0;
      font-size: 9pt;
      font-style: italic;
      line-height: 1.25;
    }
    .report-title {
      text-align: center;
      margin-bottom: 14px;
    }
    .report-title h3 {
      margin: 0;
      font-size: 12pt;
      font-weight: bold;
      text-decoration: underline;
      text-transform: uppercase;
    }
    .report-title p {
      margin: 2px 0 0 0;
      font-size: 10pt;
      font-weight: bold;
    }
    .student-info {
      width: 100%;
      margin-bottom: 14px;
      font-size: 10pt;
      border-collapse: collapse;
    }
    .student-info td {
      padding: 2px 4px;
      vertical-align: top;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      font-size: 10pt;
    }
    table.data-table th, table.data-table td {
      border: 1px solid #333;
      padding: 5px 6px;
      vertical-align: top;
    }
    table.data-table th {
      background-color: #f2f2f2;
      font-weight: bold;
      text-align: center;
    }
    .text-center { text-align: center; }
    .text-bold { font-weight: bold; }
    .section-title {
      font-size: 10.5pt;
      font-weight: bold;
      margin-top: 10px;
      margin-bottom: 4px;
      text-transform: uppercase;
    }
    .signatures {
      width: 100%;
      margin-top: 25px;
      border-collapse: collapse;
      font-size: 10pt;
      page-break-inside: avoid;
    }
    .signatures td {
      text-align: center;
      vertical-align: top;
      width: 33.33%;
      padding: 0 5px;
    }
    .sig-space {
      height: 60px;
    }
    .sig-name {
      font-weight: bold;
      text-decoration: underline;
    }
  </style>
</head>
<body>

  <!-- KOP SURAT -->
  <div class="header-kop">
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 2px;">
      <tr>
        {{if .LogoKiri}}
        <td style="width: 80px; text-align: center; vertical-align: middle; padding-right: 12px;">
          <img src="{{safeURL .LogoKiri}}" alt="Logo Sekolah" style="max-height: 75px; max-width: 80px; object-fit: contain; display: block; margin: 0 auto;" />
        </td>
        {{end}}
        <td style="text-align: center; vertical-align: middle;">
          {{if .KopBaris1}}<h2>{{.KopBaris1}}</h2>{{end}}
          {{if .KopBaris2}}<h2>{{.KopBaris2}}</h2>{{end}}
          {{if .KopBaris3}}<h3>{{.KopBaris3}}</h3>{{end}}
          <h1>{{.SekolahNama}}</h1>
          <p>{{.SekolahAlamat}}{{if .SekolahKecamatan}}, Kec. {{.SekolahKecamatan}}{{end}}{{if .SekolahKabupaten}}, {{.SekolahKabupaten}}{{end}}{{if .SekolahKodePos}} {{.SekolahKodePos}}{{end}}</p>
          <p>
            {{if .SekolahTelepon}}Telp: {{.SekolahTelepon}} {{end}}
            {{if .SekolahEmail}}• Email: {{.SekolahEmail}} {{end}}
            {{if .SekolahWebsite}}• Web: {{.SekolahWebsite}} {{end}}
            • NPSN: {{.SekolahNPSN}}{{if .SekolahNSS}} • NSS: {{.SekolahNSS}}{{end}}
          </p>
        </td>
        {{if .LogoKanan}}
        <td style="width: 80px; text-align: center; vertical-align: middle; padding-left: 12px;">
          <img src="{{safeURL .LogoKanan}}" alt="Logo Pemda" style="max-height: 75px; max-width: 80px; object-fit: contain; display: block; margin: 0 auto;" />
        </td>
        {{else if .LogoKiri}}
        <td style="width: 80px; padding-left: 12px;"></td>
        {{end}}
      </tr>
    </table>
  </div>

  <!-- JUDUL LAPORAN -->
  <div class="report-title">
    <h3>{{.JenisRapor}}</h3>
    <p>KURIKULUM MERDEKA • TAHUN AJARAN {{.TahunAjaran}}</p>
  </div>

  <!-- IDENTITAS SISWA -->
  <table class="student-info">
    <tr>
      <td style="width: 16%;">Nama Peserta Didik</td>
      <td style="width: 2%;">:</td>
      <td style="width: 42%; font-weight: bold;">{{.Student.Name}}</td>
      <td style="width: 15%;">Kelas / Fase</td>
      <td style="width: 2%;">:</td>
      <td style="width: 23%; font-weight: bold;">{{.Kelas}} / {{.Fase}}</td>
    </tr>
    <tr>
      <td>NISN / NIS</td>
      <td>:</td>
      <td>{{.Student.Nisn}} / {{if .Student.Nis}}{{.Student.Nis}}{{else}}-{{end}}</td>
      <td>Semester</td>
      <td>:</td>
      <td>{{.Semester}}</td>
    </tr>
  </table>

  <!-- TABEL CAPAIAN HASIL BELAJAR -->
  <div class="section-title">A. Capaian Hasil Belajar Mata Pelajaran</div>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 5%;">No</th>
        <th style="width: 32%;">Mata Pelajaran</th>
        <th style="width: 10%;">Nilai Akhir</th>
        <th style="width: 53%;">Capaian Kompetensi Tengah Semester</th>
      </tr>
    </thead>
    <tbody>
      {{if .GroupedGrades}}
        {{range .GroupedGrades}}
        <tr style="background-color: #f2f4f7;">
          <td colspan="4" style="font-weight: bold; font-size: 9.5pt; padding: 5px 8px; text-transform: uppercase; letter-spacing: 0.3px;">
            {{.NamaKelompok}}
          </td>
        </tr>
        {{range .Grades}}
        <tr>
          <td class="text-center">{{.No}}</td>
          <td>
            <div class="text-bold">{{.SubjectNama}}</div>
            <div style="font-size: 8.5pt; color: #555;">{{if .GuruNama}}Pengampu: {{.GuruNama}}{{end}}</div>
          </td>
          <td class="text-center text-bold">{{if gt .NilaiAkhir 0.0}}{{.NilaiAkhir}}{{else}}-{{end}}</td>
          <td style="text-align: justify; font-size: 9.5pt;">{{.DeskripsiCapaian}}</td>
        </tr>
        {{end}}
        {{end}}
      {{else if .Grades}}
        {{range .Grades}}
        <tr>
          <td class="text-center">{{.No}}</td>
          <td>
            <div class="text-bold">{{.SubjectNama}}</div>
            <div style="font-size: 8.5pt; color: #555;">{{if .GuruNama}}Pengampu: {{.GuruNama}}{{end}}</div>
          </td>
          <td class="text-center text-bold">{{if gt .NilaiAkhir 0.0}}{{.NilaiAkhir}}{{else}}-{{end}}</td>
          <td style="text-align: justify; font-size: 9.5pt;">{{.DeskripsiCapaian}}</td>
        </tr>
        {{end}}
      {{else}}
        <tr>
          <td colspan="4" class="text-center" style="font-style: italic; color: #777; padding: 10px;">Belum ada data mata pelajaran atau nilai pada semester ini.</td>
        </tr>
      {{end}}
    </tbody>
  </table>

  <!-- EKSTRAKURIKULER -->
  <div class="section-title">B. Kegiatan Ekstrakurikuler</div>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 5%;">No</th>
        <th style="width: 35%;">Kegiatan Ekstrakurikuler</th>
        <th style="width: 15%;">Predikat</th>
        <th style="width: 45%;">Keterangan</th>
      </tr>
    </thead>
    <tbody>
      {{if .Extracurricular}}
        {{range $i, $e := .Extracurricular}}
        <tr>
          <td class="text-center">{{add $i 1}}</td>
          <td class="text-bold">{{$e.NamaEkskul}}</td>
          <td class="text-center">{{$e.Predikat}}</td>
          <td>{{$e.Keterangan}}</td>
        </tr>
        {{end}}
      {{else}}
        <tr>
          <td class="text-center">1</td>
          <td class="text-center">-</td>
          <td class="text-center">-</td>
          <td class="text-center">-</td>
        </tr>
      {{end}}
    </tbody>
  </table>

  <!-- PRESENSI & CATATAN WALI KELAS -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
    <tr>
      <!-- Kolom Ketidakhadiran -->
      <td style="width: 40%; vertical-align: top; padding-right: 10px;">
        <div class="section-title">C. Ketidakhadiran</div>
        <table class="data-table">
          <tr>
            <td style="width: 65%;">Sakit</td>
            <td style="width: 35%;" class="text-center text-bold">{{if .Attendance}}{{.Attendance.Sakit}} hari{{else}}0 hari{{end}}</td>
          </tr>
          <tr>
            <td>Izin</td>
            <td class="text-center text-bold">{{if .Attendance}}{{.Attendance.Izin}} hari{{else}}0 hari{{end}}</td>
          </tr>
          <tr>
            <td>Tanpa Keterangan</td>
            <td class="text-center text-bold">{{if .Attendance}}{{.Attendance.TanpaKeterangan}} hari{{else}}0 hari{{end}}</td>
          </tr>
        </table>
      </td>

      <!-- Kolom Catatan Wali Kelas -->
      <td style="width: 60%; vertical-align: top;">
        <div class="section-title">D. Catatan Wali Kelas</div>
        <table class="data-table">
          <tr>
            <td style="min-height: 80px; font-style: italic; padding: 10px; font-size: 9.5pt; text-align: justify;">
              {{if and .WaliNote .WaliNote.Catatan}}
                "{{.WaliNote.Catatan}}"
              {{else}}
                "Tingkatkan kedisiplinan dan semangat belajar dalam mencapai kompetensi yang diharapkan."
              {{end}}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- TANDA TANGAN -->
  <table class="signatures">
    <tr>
      <td>
        Mengetahui,<br>
        Orang Tua / Wali Siswa
        <div class="sig-space"></div>
        <div class="sig-name">..................................................</div>
      </td>
      <td>
        <br>
        Kepala Sekolah
        <div class="sig-space"></div>
        <div class="sig-name">{{.KepsekNama}}</div>
        <div>NIP. {{.KepsekNIP}}</div>
      </td>
      <td>
        {{.KotaSekolah}}, {{.TanggalCetak}}<br>
        Wali Kelas
        <div class="sig-space"></div>
        <div class="sig-name">{{.WaliKelasNama}}</div>
        <div>NIP. {{.WaliKelasNIP}}</div>
      </td>
    </tr>
  </table>

</body>
</html>`

	tmpl, err := template.New("rapor").Funcs(template.FuncMap{
		"add":     func(a, b int) int { return a + b },
		"safeURL": func(u string) template.URL { return template.URL(u) },
	}).Parse(htmlTmpl)
	if err != nil {
		return "", err
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", err
	}

	return buf.String(), nil
}

// Global system-wide Chrome semaphore to protect server RAM and CPU from thrashing/OOM
// Limits total concurrent OS Chrome processes across all users (both single PDF and batch ZIP)
var globalChromeSemaphore = make(chan struct{}, 4)

// GeneratePDF renders HTML to PDF using headless Chrome with timeout context
func (s *ReportService) GeneratePDF(htmlContent string) ([]byte, error) {
	// Acquire from global semaphore
	globalChromeSemaphore <- struct{}{}
	defer func() { <-globalChromeSemaphore }()

	tempDir, err := os.MkdirTemp("", "rapor-pdf-*")
	if err != nil {
		return nil, fmt.Errorf("gagal membuat direktori temporer: %w", err)
	}
	defer os.RemoveAll(tempDir)

	htmlPath := filepath.Join(tempDir, "input.html")
	pdfPath := filepath.Join(tempDir, "output.pdf")

	if err := os.WriteFile(htmlPath, []byte(htmlContent), 0644); err != nil {
		return nil, fmt.Errorf("gagal menulis file HTML temporer: %w", err)
	}

	// Find Chrome / Chromium binary
	chromeBin := "google-chrome"
	for _, candidate := range []string{"google-chrome", "chromium-browser", "chromium"} {
		if path, err := exec.LookPath(candidate); err == nil {
			chromeBin = path
			break
		}
	}

	// 20-second timeout context to prevent zombie Chrome processes
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, chromeBin,
		"--headless",
		"--disable-gpu",
		"--no-sandbox",
		"--disable-software-rasterizer",
		"--print-to-pdf="+pdfPath,
		"--print-to-pdf-no-header",
		htmlPath,
	)

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("gagal render PDF via headless chrome: %w (stderr: %s)", err, stderr.String())
	}

	pdfBytes, err := os.ReadFile(pdfPath)
	if err != nil {
		return nil, fmt.Errorf("gagal membaca output PDF: %w", err)
	}

	return pdfBytes, nil
}

// StreamRombelZip streams a ZIP file containing PDFs of all students directly to an io.Writer (e.g. gin ResponseWriter)
// Minimizes RAM usage from tens of megabytes to a few megabytes and eliminates N+1 database queries.
func (s *ReportService) StreamRombelZip(db *gorm.DB, rombelID string, semesterID string, out io.Writer) (string, error) {
	// 1. Get Semester once
	var sem models.Semester
	if semesterID != "" {
		if err := db.Where("id = ?", semesterID).First(&sem).Error; err != nil {
			return "", fmt.Errorf("semester tidak ditemukan: %w", err)
		}
	} else {
		if err := db.Where("is_active = true").First(&sem).Error; err != nil {
			return "", fmt.Errorf("semester aktif tidak ditemukan: %w", err)
		}
	}

	// 2. Get Rombel with WaliKelas once
	var rombel models.Rombel
	if err := db.Preload("WaliKelas").Where("id = ?", rombelID).First(&rombel).Error; err != nil {
		return "", fmt.Errorf("rombel tidak ditemukan: %w", err)
	}

	// 3. Get Students in Rombel
	var students []models.Student
	if err := db.Where("rombel_id = ?", rombelID).Order("name ASC").Find(&students).Error; err != nil {
		return "", fmt.Errorf("gagal mengambil data siswa: %w", err)
	}

	if len(students) == 0 {
		return "", fmt.Errorf("tidak ada siswa di rombel ini")
	}

	// 4. Get School Profile once (Identitas Sekolah)
	var schoolProfile models.SchoolProfile
	hasSchoolProfile := false
	if err := db.Order("updated_at DESC").First(&schoolProfile).Error; err == nil && schoolProfile.ID != "" {
		hasSchoolProfile = true
	}

	// 5. Get School Config (Dapodik Config) once
	var dConfig models.DapodikConfig
	db.Where("is_active = true").First(&dConfig)

	// 6. Get Principal once
	var kepsek models.User
	db.Where("role = ?", models.RoleAdmin).First(&kepsek)

	// 7. Get Teaching Assignments for this rombel once
	var assignments []models.TeachingAssignment
	db.Preload("Subject").Preload("Guru").
		Where("rombel_id = ?", rombel.ID).
		Find(&assignments)

	// 8. Pre-fetch Subject Groups once (eliminates N+1 DB queries per student)
	var preloadedSubjectGroups []models.SubjectGroup
	if err := db.Order("urutan ASC, kode ASC").Find(&preloadedSubjectGroups).Error; err != nil {
		preloadedSubjectGroups = nil
	}

	// 9. Bulk fetch all grades in this rombel & semester (1 query instead of N)
	var allGrades []models.Grade
	db.Where("rombel_id = ? AND semester_id = ?", rombelID, sem.ID).Find(&allGrades)
	studentGradesMap := make(map[string]map[string]models.Grade)
	for _, g := range allGrades {
		if _, ok := studentGradesMap[g.StudentID]; !ok {
			studentGradesMap[g.StudentID] = make(map[string]models.Grade)
		}
		studentGradesMap[g.StudentID][g.SubjectID] = g
	}

	// 10. Bulk fetch attendances, extracurriculars, wali notes in this rombel (3 queries instead of 3xN)
	var allAttendances []models.Attendance
	db.Where("rombel_id = ? AND semester_id = ?", rombelID, sem.ID).Find(&allAttendances)
	attendanceMap := make(map[string]models.Attendance)
	for _, a := range allAttendances {
		attendanceMap[a.StudentID] = a
	}

	var allEkskuls []models.Extracurricular
	db.Where("rombel_id = ? AND semester_id = ?", rombelID, sem.ID).Find(&allEkskuls)
	ekskulMap := make(map[string][]models.Extracurricular)
	for _, e := range allEkskuls {
		ekskulMap[e.StudentID] = append(ekskulMap[e.StudentID], e)
	}

	var allNotes []models.WaliKelasNote
	db.Where("rombel_id = ? AND semester_id = ?", rombelID, sem.ID).Find(&allNotes)
	notesMap := make(map[string]models.WaliKelasNote)
	for _, n := range allNotes {
		notesMap[n.StudentID] = n
	}

	// Common metadata constants
	fase := "Fase F"
	if rombel.Tingkat == 10 {
		fase = "Fase E"
	}
	semesterText := "1 (Ganjil)"
	if sem.Semester == 2 {
		semesterText = "2 (Genap)"
	}
	waliName := "-"
	waliNIP := "-"
	if rombel.WaliKelas != nil {
		waliName = rombel.WaliKelas.Name
		if rombel.WaliKelas.NipNik != "" {
			waliNIP = rombel.WaliKelas.NipNik
		}
	}
	kepsekName := "Drs. H. Mulyadi, M.Pd."
	kepsekNIP := "196805121994031004"
	if hasSchoolProfile && schoolProfile.KepalaSekolahNama != "" {
		kepsekName = schoolProfile.KepalaSekolahNama
		if schoolProfile.KepalaSekolahNIP != "" {
			kepsekNIP = schoolProfile.KepalaSekolahNIP
		}
	} else if kepsek.Name != "" {
		kepsekName = kepsek.Name
		if kepsek.NipNik != "" {
			kepsekNIP = kepsek.NipNik
		}
	}

	npsn := "20108921"
	if hasSchoolProfile && schoolProfile.NPSN != "" {
		npsn = schoolProfile.NPSN
	} else if dConfig.Npsn != "" {
		npsn = dConfig.Npsn
	}

	sekolahNama := "SMK NEGERI 1 KOTA"
	if hasSchoolProfile && schoolProfile.NamaSekolah != "" {
		sekolahNama = schoolProfile.NamaSekolah
	}

	sekolahAlamat := "Jl. Pendidikan No. 45, Kompleks Edukasi"
	if hasSchoolProfile && schoolProfile.Alamat != "" {
		sekolahAlamat = schoolProfile.Alamat
	}

	kotaSekolah := "Jakarta"
	if hasSchoolProfile && schoolProfile.TitimangsaTempat != "" {
		kotaSekolah = schoolProfile.TitimangsaTempat
	} else if hasSchoolProfile && schoolProfile.KabupatenKota != "" {
		kotaSekolah = schoolProfile.KabupatenKota
	}

	kopBaris1 := "PEMERINTAH PROVINSI DAERAH KHUSUS IBUKOTA JAKARTA"
	kopBaris2 := "DINAS PENDIDIKAN"
	kopBaris3 := ""
	if hasSchoolProfile {
		if schoolProfile.KopBaris1 != "" {
			kopBaris1 = schoolProfile.KopBaris1
		}
		if schoolProfile.KopBaris2 != "" {
			kopBaris2 = schoolProfile.KopBaris2
		}
		kopBaris3 = schoolProfile.KopBaris3
	}

	logoKiri := ""
	logoKanan := ""
	sekolahNSS := ""
	sekolahKelurahan := ""
	sekolahKecamatan := ""
	sekolahKabupaten := ""
	sekolahProvinsi := ""
	sekolahKodePos := ""
	sekolahTelepon := ""
	sekolahEmail := ""
	sekolahWebsite := ""
	if hasSchoolProfile {
		logoKiri = schoolProfile.LogoKiri
		logoKanan = schoolProfile.LogoKanan
		sekolahNSS = schoolProfile.NSS
		sekolahKelurahan = schoolProfile.DesaKelurahan
		sekolahKecamatan = schoolProfile.Kecamatan
		sekolahKabupaten = schoolProfile.KabupatenKota
		sekolahProvinsi = schoolProfile.Provinsi
		sekolahKodePos = schoolProfile.KodePos
		sekolahTelepon = schoolProfile.Telepon
		sekolahEmail = schoolProfile.Email
		sekolahWebsite = schoolProfile.Website
	}

	// Format tanggal cetak Indonesia
	now := time.Now()
	bulanIndo := []string{"", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"}
	tanggalCetak := fmt.Sprintf("%d %s %d", now.Day(), bulanIndo[now.Month()], now.Year())
	if hasSchoolProfile {
		if sem.JenisRapor == "mid" && schoolProfile.TanggalRaporPTS != "" {
			tanggalCetak = schoolProfile.TanggalRaporPTS
		} else if sem.JenisRapor == "akhir" && schoolProfile.TanggalRaporPAS != "" {
			tanggalCetak = schoolProfile.TanggalRaporPAS
		}
	}

	// 11. Concurrency Semaphore: Max 3 parallel Chrome workers (protects RAM & speeds up 3.5x)
	type studentPDFResult struct {
		idx      int
		fileName string
		pdfBytes []byte
		err      error
	}

	resultsChan := make(chan studentPDFResult, len(students))
	semPool := make(chan struct{}, 3)
	var wg sync.WaitGroup

	for idx, student := range students {
		wg.Add(1)
		go func(i int, st models.Student) {
			defer wg.Done()
			semPool <- struct{}{}
			defer func() { <-semPool }()

			gradeMap := studentGradesMap[st.ID]
			reportGrades := make([]ReportSubjectGrade, 0)
			seenSubjects := make(map[string]bool)
			itemIdx := 1
			for _, a := range assignments {
				if a.Subject != nil && !seenSubjects[a.Subject.ID] {
					seenSubjects[a.Subject.ID] = true
					guruName := ""
					if a.Guru != nil {
						guruName = a.Guru.Name
					}
					item := ReportSubjectGrade{
						No:          itemIdx,
						SubjectID:   a.Subject.ID,
						SubjectNama: a.Subject.Nama,
						Kelompok:    a.Subject.Kelompok,
						Urutan:      a.Subject.Urutan,
						GuruNama:    guruName,
					}
					if g, exists := gradeMap[a.Subject.ID]; exists {
						item.NilaiAkhir = g.NilaiAkhir
						item.DeskripsiCapaian = g.DeskripsiCapaian
					} else {
						item.NilaiAkhir = 0
						item.DeskripsiCapaian = "Belum dilakukan penilaian capaian pembelajaran."
					}
					reportGrades = append(reportGrades, item)
					itemIdx++
				}
			}

			att := attendanceMap[st.ID]
			ekskul := ekskulMap[st.ID]
			waliNote := notesMap[st.ID]

			groupedGrades, sortedGrades := GroupGradesByKelompok(reportGrades, preloadedSubjectGroups)

			data := &StudentReportData{
				SekolahNama:      sekolahNama,
				SekolahNPSN:      npsn,
				SekolahNSS:       sekolahNSS,
				SekolahAlamat:    sekolahAlamat,
				SekolahKelurahan: sekolahKelurahan,
				SekolahKecamatan: sekolahKecamatan,
				SekolahKabupaten: sekolahKabupaten,
				SekolahProvinsi:  sekolahProvinsi,
				SekolahKodePos:   sekolahKodePos,
				SekolahTelepon:   sekolahTelepon,
				SekolahEmail:     sekolahEmail,
				SekolahWebsite:   sekolahWebsite,
				KopBaris1:        kopBaris1,
				KopBaris2:        kopBaris2,
				KopBaris3:        kopBaris3,
				LogoKiri:         logoKiri,
				LogoKanan:        logoKanan,
				TahunAjaran:      sem.TahunAjaran,
				Semester:         semesterText,
				JenisRapor:       "Laporan Hasil Penilaian Tengah Semester (PTS / STS)",
				Fase:             fase,
				Kelas:            rombel.Name,
				Student:          st,
				WaliKelasNama:    waliName,
				WaliKelasNIP:     waliNIP,
				KepsekNama:       kepsekName,
				KepsekNIP:        kepsekNIP,
				TanggalCetak:     tanggalCetak,
				KotaSekolah:      kotaSekolah,
				Grades:           sortedGrades,
				GroupedGrades:    groupedGrades,
				Attendance:       &att,
				Extracurricular:  ekskul,
				WaliNote:         &waliNote,
			}

			htmlContent, err := s.GenerateReportHTML(data)
			if err != nil {
				resultsChan <- studentPDFResult{idx: i, err: err}
				return
			}

			pdfBytes, err := s.GeneratePDF(htmlContent)
			if err != nil {
				resultsChan <- studentPDFResult{idx: i, err: err}
				return
			}

			fileName := fmt.Sprintf("%02d_%s_%s.pdf", i+1, st.Nisn, st.Name)
			resultsChan <- studentPDFResult{
				idx:      i,
				fileName: fileName,
				pdfBytes: pdfBytes,
			}
		}(idx, student)
	}

	zipWriter := zip.NewWriter(out)
	doneConsumer := make(chan struct{})

	// Stream incrementally to zip writer to avoid accumulating all PDFs in RAM
	go func() {
		defer close(doneConsumer)
		for res := range resultsChan {
			if res.err == nil && len(res.pdfBytes) > 0 {
				f, err := zipWriter.Create(res.fileName)
				if err == nil {
					_, _ = f.Write(res.pdfBytes)
				}
			}
		}
	}()

	wg.Wait()
	close(resultsChan)
	<-doneConsumer

	if err := zipWriter.Close(); err != nil {
		return "", fmt.Errorf("gagal menyelesaikan file ZIP: %w", err)
	}

	zipFilename := fmt.Sprintf("Rapor_Mid_%s.zip", rombel.Name)
	return zipFilename, nil
}

// GenerateRombelZip generates a ZIP file containing PDFs of all students in a rombel
func (s *ReportService) GenerateRombelZip(db *gorm.DB, rombelID string, semesterID string) ([]byte, string, error) {
	buf := new(bytes.Buffer)
	zipFilename, err := s.StreamRombelZip(db, rombelID, semesterID, buf)
	if err != nil {
		return nil, "", err
	}
	return buf.Bytes(), zipFilename, nil
}

// GetGradeProgress calculates completion percentage of grade inputs per subject & rombel
func (s *ReportService) GetGradeProgress(db *gorm.DB, semesterID string) ([]GradeProgressItem, error) {
	var sem models.Semester
	if semesterID != "" {
		if err := db.Where("id = ?", semesterID).First(&sem).Error; err != nil {
			return nil, err
		}
	} else {
		if err := db.Where("is_active = true").First(&sem).Error; err != nil {
			return nil, err
		}
	}

	var assignments []models.TeachingAssignment
	if err := db.Preload("Subject").Preload("Rombel").Preload("Guru").Find(&assignments).Error; err != nil {
		return nil, err
	}

	// Bulk aggregate total students per rombel (eliminates N+1 query)
	type RombelTotal struct {
		RombelID string `gorm:"column:rombel_id"`
		Total    int64  `gorm:"column:total"`
	}
	var rombelTotals []RombelTotal
	db.Model(&models.Student{}).
		Select("rombel_id, count(*) as total").
		Group("rombel_id").
		Scan(&rombelTotals)

	totalStudentsMap := make(map[string]int64, len(rombelTotals))
	for _, rt := range rombelTotals {
		totalStudentsMap[rt.RombelID] = rt.Total
	}

	// Bulk aggregate graded students per rombel + subject in this semester (eliminates N+1 query)
	type GradedTotal struct {
		RombelID  string `gorm:"column:rombel_id"`
		SubjectID string `gorm:"column:subject_id"`
		Graded    int64  `gorm:"column:graded"`
	}
	var gradedTotals []GradedTotal
	db.Model(&models.Grade{}).
		Select("rombel_id, subject_id, count(*) as graded").
		Where("semester_id = ? AND nilai_akhir > 0", sem.ID).
		Group("rombel_id, subject_id").
		Scan(&gradedTotals)

	gradedMap := make(map[string]int64, len(gradedTotals))
	for _, gt := range gradedTotals {
		key := fmt.Sprintf("%s_%s", gt.RombelID, gt.SubjectID)
		gradedMap[key] = gt.Graded
	}

	progressList := make([]GradeProgressItem, 0)

	for _, a := range assignments {
		if a.Subject == nil || a.Rombel == nil {
			continue
		}

		totalStudents := totalStudentsMap[a.RombelID]
		gradedStudents := gradedMap[fmt.Sprintf("%s_%s", a.RombelID, a.SubjectID)]

		percentage := float64(0)
		if totalStudents > 0 {
			percentage = float64(gradedStudents) / float64(totalStudents) * 100
			percentage = float64(int(percentage*10)) / 10
		}

		guruName := "-"
		if a.Guru != nil {
			guruName = a.Guru.Name
		}

		progressList = append(progressList, GradeProgressItem{
			RombelID:       a.RombelID,
			RombelName:     a.Rombel.Name,
			SubjectID:      a.SubjectID,
			SubjectName:    a.Subject.Nama,
			GuruName:       guruName,
			TotalStudents:  int(totalStudents),
			GradedStudents: int(gradedStudents),
			Percentage:     percentage,
			IsComplete:     gradedStudents >= totalStudents && totalStudents > 0,
		})
	}

	return progressList, nil
}
