package services

import (
	"testing"

	"rapor-smk-backend/models"
)

func TestGroupGradesByKelompokOrdering(t *testing.T) {
	sampleGrades := []ReportSubjectGrade{
		{SubjectID: "sub-b-2", SubjectNama: "Bahasa Inggris", Kelompok: "B", Urutan: 2},
		{SubjectID: "sub-a-2", SubjectNama: "Bahasa Indonesia", Kelompok: "A", Urutan: 2},
		{SubjectID: "sub-a-1", SubjectNama: "Pendidikan Agama", Kelompok: "A", Urutan: 1},
		{SubjectID: "sub-b-1", SubjectNama: "Matematika Kejuruan", Kelompok: "B", Urutan: 1},
		{SubjectID: "sub-mulok-1", SubjectNama: "Bahasa Jawa", Kelompok: "Muatan Lokal", Urutan: 1},
		{SubjectID: "sub-a-3", SubjectNama: "Pendidikan Pancasila", Kelompok: "A", Urutan: 3},
	}

	grouped, flat := GroupGradesByKelompok(sampleGrades)

	if len(grouped) < 3 {
		t.Fatalf("Expected at least 3 groups, got %d", len(grouped))
	}

	// Verify group 0 is Kelompok A
	if grouped[0].KodeKelompok != "A" {
		t.Errorf("Expected first group to be A, got %s", grouped[0].KodeKelompok)
	}

	// In Kelompok A, verify subjects order: Urutan 1, Urutan 2, Urutan 3
	if len(grouped[0].Grades) != 3 {
		t.Fatalf("Expected 3 grades in group A, got %d", len(grouped[0].Grades))
	}
	if grouped[0].Grades[0].SubjectNama != "Pendidikan Agama" || grouped[0].Grades[0].Urutan != 1 {
		t.Errorf("Expected first subject in A to be Pendidikan Agama (urutan 1), got %s", grouped[0].Grades[0].SubjectNama)
	}
	if grouped[0].Grades[1].SubjectNama != "Bahasa Indonesia" || grouped[0].Grades[1].Urutan != 2 {
		t.Errorf("Expected second subject in A to be Bahasa Indonesia (urutan 2), got %s", grouped[0].Grades[1].SubjectNama)
	}
	if grouped[0].Grades[2].SubjectNama != "Pendidikan Pancasila" || grouped[0].Grades[2].Urutan != 3 {
		t.Errorf("Expected third subject in A to be Pendidikan Pancasila (urutan 3), got %s", grouped[0].Grades[2].SubjectNama)
	}

	// Verify group 1 is Kelompok B
	if grouped[1].KodeKelompok != "B" {
		t.Errorf("Expected second group to be B, got %s", grouped[1].KodeKelompok)
	}
	if grouped[1].Grades[0].SubjectNama != "Matematika Kejuruan" || grouped[1].Grades[0].Urutan != 1 {
		t.Errorf("Expected first subject in B to be Matematika Kejuruan (urutan 1), got %s", grouped[1].Grades[0].SubjectNama)
	}

	// Verify sequential numbering across all items
	for i, f := range flat {
		if f.No != i+1 {
			t.Errorf("Expected flat[%d].No to be %d, got %d", i, i+1, f.No)
		}
	}
}

func TestGenerateReportHTMLWithSchoolProfile(t *testing.T) {
	svc := NewReportService()

	reportData := &StudentReportData{
		SekolahNama:      "SMK Negeri 1 Banyuwangi",
		SekolahNPSN:      "20525633",
		SekolahNSS:       "401052501001",
		SekolahAlamat:    "Jl. Wijaya Kusuma No. 46",
		SekolahKecamatan: "Giri",
		SekolahKabupaten: "Kab. Banyuwangi",
		SekolahProvinsi:  "Jawa Timur",
		SekolahKodePos:   "68425",
		SekolahTelepon:   "0333-424541",
		SekolahEmail:     "smkn1banyuwangi@yahoo.com",
		SekolahWebsite:   "https://smkn1bwi.sch.id",
		KopBaris1:        "PEMERINTAH PROVINSI JAWA TIMUR",
		KopBaris2:        "DINAS PENDIDIKAN",
		KopBaris3:        "CABANG DINAS PENDIDIKAN WILAYAH BANYUWANGI",
		LogoKiri:         "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
		LogoKanan:        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
		TahunAjaran:      "2024/2025",
		Semester:         "1 (Ganjil)",
		JenisRapor:       "Laporan Hasil Penilaian Tengah Semester (PTS / STS)",
		Fase:             "Fase F",
		Kelas:            "XI RPL 1",
		KepsekNama:       "Drs. H. Mulyadi, M.Pd.",
		KepsekNIP:        "196805121994031004",
		WaliKelasNama:    "Pak Ahmad Fauzi, S.Pd.",
		WaliKelasNIP:     "198001012005011001",
		TanggalCetak:     "20 Oktober 2024",
		KotaSekolah:      "Banyuwangi",
	}

	html, err := svc.GenerateReportHTML(reportData)
	if err != nil {
		t.Fatalf("GenerateReportHTML returned error: %v", err)
	}

	if html == "" {
		t.Fatal("GenerateReportHTML returned empty string")
	}

	// Verify rendered school info
	expectedSubstrings := []string{
		"SMK Negeri 1 Banyuwangi",
		"20525633",
		"Jl. Wijaya Kusuma No. 46",
		"PEMERINTAH PROVINSI JAWA TIMUR",
		"DINAS PENDIDIKAN",
		"CABANG DINAS PENDIDIKAN WILAYAH BANYUWANGI",
		"Banyuwangi",
		"20 Oktober 2024",
		"data:image/png;base64",
	}

	for _, sub := range expectedSubstrings {
		if !containsString(html, sub) {
			t.Errorf("Expected HTML to contain %q, but was missing", sub)
		}
	}
}

func TestGroupGradesByKelompokWithPreloadedGroups(t *testing.T) {
	customGroups := []models.SubjectGroup{
		{Kode: "MUATAN_KHUSUS", Nama: "Kelompok Kejuruan Khusus", Urutan: 1},
		{Kode: "A", Nama: "Kelompok Umum A", Urutan: 2},
	}

	sampleGrades := []ReportSubjectGrade{
		{SubjectID: "sub-1", SubjectNama: "Dasar Jurusan", Kelompok: "MUATAN_KHUSUS", Urutan: 1},
		{SubjectID: "sub-2", SubjectNama: "Pendidikan Agama", Kelompok: "A", Urutan: 1},
	}

	grouped, flat := GroupGradesByKelompok(sampleGrades, customGroups)

	if len(grouped) != 2 {
		t.Fatalf("Expected 2 groups, got %d", len(grouped))
	}

	// Because MUATAN_KHUSUS has Urutan: 1 in customGroups, it should appear first
	if grouped[0].KodeKelompok != "MUATAN_KHUSUS" {
		t.Errorf("Expected first group to be MUATAN_KHUSUS, got %s", grouped[0].KodeKelompok)
	}
	if grouped[1].KodeKelompok != "A" {
		t.Errorf("Expected second group to be A, got %s", grouped[1].KodeKelompok)
	}

	if len(flat) != 2 {
		t.Fatalf("Expected 2 flat grades, got %d", len(flat))
	}
}

func containsString(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 || (len(s) > 0 && len(substr) > 0 && stringContains(s, substr)))
}

func stringContains(s, substr string) bool {
	for i := 0; i+len(substr) <= len(s); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
