package services

import (
	"strings"
	"testing"

	"rapor-smk-backend/models"
)

func TestGenerateDeskripsiCapaianCheckmarkMode(t *testing.T) {
	svc := NewGradeService()

	tpMap := map[string]models.LearningObjective{
		"tp-1": {ID: "tp-1", KodeTP: "TP-1.1", Deskripsi: "Memahami konsep basis data relasional"},
		"tp-2": {ID: "tp-2", KodeTP: "TP-1.2", Deskripsi: "Menerapkan query SQL dan normalisasi data"},
	}

	// Case 1: Both achieved (Centang semua)
	detailsAllAchieved := []models.GradeDetail{
		{LearningObjectiveID: "tp-1", Nilai: 1},
		{LearningObjectiveID: "tp-2", Nilai: 1},
	}
	descAll := svc.GenerateDeskripsiCapaian("Budi", detailsAllAchieved, tpMap)
	if !strings.Contains(descAll, "penguasaan yang sangat baik") {
		t.Errorf("Expected all achieved description, got: %s", descAll)
	}

	// Case 2: One achieved, one not (Centang sebagian)
	detailsPartial := []models.GradeDetail{
		{LearningObjectiveID: "tp-1", Nilai: 1},
		{LearningObjectiveID: "tp-2", Nilai: 0},
	}
	descPartial := svc.GenerateDeskripsiCapaian("Budi", detailsPartial, tpMap)
	if !strings.Contains(descPartial, "penguasaan yang baik dalam memahami konsep basis data relasional") {
		t.Errorf("Expected achieved part in description, got: %s", descPartial)
	}
	if !strings.Contains(descPartial, "perlu peningkatan dan bimbingan dalam menerapkan query SQL dan normalisasi data") {
		t.Errorf("Expected guidance part in description, got: %s", descPartial)
	}

	// Case 3: None achieved (Belum centang)
	detailsNone := []models.GradeDetail{
		{LearningObjectiveID: "tp-1", Nilai: 0},
		{LearningObjectiveID: "tp-2", Nilai: 0},
	}
	descNone := svc.GenerateDeskripsiCapaian("Budi", detailsNone, tpMap)
	if !strings.Contains(descNone, "Perlu bimbingan dan peningkatan dalam memahami konsep basis data relasional serta menerapkan query SQL dan normalisasi data.") {
		t.Errorf("Expected specific unachieved guidance, got: %s", descNone)
	}

	// Case 4: Single TP unachieved with redundant teacher prefix
	tpMapSingle := map[string]models.LearningObjective{
		"tp-pc": {ID: "tp-pc", KodeTP: "TP-1.1", Deskripsi: "Menunjukkan penguasaan yang baik dalam perakitan PC"},
	}
	detailsSingleUnachieved := []models.GradeDetail{
		{LearningObjectiveID: "tp-pc", Nilai: 0},
	}
	descSingle := svc.GenerateDeskripsiCapaian("Ajeng", detailsSingleUnachieved, tpMapSingle)
	expectedSingle := "Perlu bimbingan dan peningkatan dalam perakitan PC."
	if descSingle != expectedSingle {
		t.Errorf("Expected cleaned unachieved description '%s', got: '%s'", expectedSingle, descSingle)
	}

	// Case 5: Single TP achieved with redundant teacher prefix
	detailsSingleAchieved := []models.GradeDetail{
		{LearningObjectiveID: "tp-pc", Nilai: 1},
	}
	descSingleAchieved := svc.GenerateDeskripsiCapaian("Ajeng", detailsSingleAchieved, tpMapSingle)
	expectedSingleAchieved := "Menunjukkan penguasaan yang sangat baik dalam perakitan PC."
	if descSingleAchieved != expectedSingleAchieved {
		t.Errorf("Expected cleaned achieved description '%s', got: '%s'", expectedSingleAchieved, descSingleAchieved)
	}
}

func TestCalculateNilaiAkhirCheckmarkMode(t *testing.T) {
	svc := NewGradeService()

	// Checkmark details should not evaluate to 1.0
	details := []models.GradeDetail{
		{LearningObjectiveID: "tp-1", Nilai: 1},
		{LearningObjectiveID: "tp-2", Nilai: 1},
	}
	score := svc.CalculateNilaiAkhir(details)
	if score != 0 {
		t.Errorf("Expected 0 for checkmark mode (manual final score should be used), got %f", score)
	}
}

func TestTeacherScopedLearningObjectivesDescription(t *testing.T) {
	svc := NewGradeService()

	guruAID := "guru-rpl-01"
	guruBID := "guru-akt-02"
	subjectID := "sub-math"

	// Guru A's TPs (RPL: Aljabar Boolean & Logika Proposisi)
	tpMapGuruA := map[string]models.LearningObjective{
		"tp-a-1": {ID: "tp-a-1", SubjectID: subjectID, GuruID: &guruAID, KodeTP: "TP-1.1", Deskripsi: "memahami aljabar boolean dan gerbang logika"},
		"tp-a-2": {ID: "tp-a-2", SubjectID: subjectID, GuruID: &guruAID, KodeTP: "TP-1.2", Deskripsi: "menerapkan logika proposisi dalam algoritma"},
	}

	// Guru B's TPs (Akuntansi: Matematika Keuangan & Bunga Majemuk)
	tpMapGuruB := map[string]models.LearningObjective{
		"tp-b-1": {ID: "tp-b-1", SubjectID: subjectID, GuruID: &guruBID, KodeTP: "TP-1.1", Deskripsi: "menghitung bunga majemuk dan anuitas"},
		"tp-b-2": {ID: "tp-b-2", SubjectID: subjectID, GuruID: &guruBID, KodeTP: "TP-1.2", Deskripsi: "menganalisis laporan keuangan sederhana"},
	}

	// Student in Class RPL taught by Guru A
	studentRPLDetails := []models.GradeDetail{
		{LearningObjectiveID: "tp-a-1", Nilai: 1},
		{LearningObjectiveID: "tp-a-2", Nilai: 0},
	}
	descRPL := svc.GenerateDeskripsiCapaian("Ahmad", studentRPLDetails, tpMapGuruA)

	// Verify Guru A's student gets descriptions containing Guru A's TPs and NOT Guru B's TPs
	if !strings.Contains(descRPL, "aljabar boolean") {
		t.Errorf("Expected description to contain 'aljabar boolean', got: %s", descRPL)
	}
	if strings.Contains(descRPL, "bunga majemuk") {
		t.Errorf("Expected description NOT to contain Guru B's TP 'bunga majemuk', got: %s", descRPL)
	}

	// Student in Class Akuntansi taught by Guru B
	studentAKTDetails := []models.GradeDetail{
		{LearningObjectiveID: "tp-b-1", Nilai: 1},
		{LearningObjectiveID: "tp-b-2", Nilai: 0},
	}
	descAKT := svc.GenerateDeskripsiCapaian("Siti", studentAKTDetails, tpMapGuruB)

	// Verify Guru B's student gets descriptions containing Guru B's TPs and NOT Guru A's TPs
	if !strings.Contains(descAKT, "bunga majemuk") {
		t.Errorf("Expected description to contain 'bunga majemuk', got: %s", descAKT)
	}
	if strings.Contains(descAKT, "aljabar boolean") {
		t.Errorf("Expected description NOT to contain Guru A's TP 'aljabar boolean', got: %s", descAKT)
	}
}
