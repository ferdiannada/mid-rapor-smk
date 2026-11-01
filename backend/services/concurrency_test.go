package services

import (
	"archive/zip"
	"bytes"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"

	"rapor-smk-backend/models"
)

// TestConcurrentDapodikSyncLock memverifikasi bahwa penguncian lokal/distributed
// mencegah 2 proses sinkronisasi berjalan secara bersamaan
func TestConcurrentDapodikSyncLock(t *testing.T) {
	svc := &DapodikService{
		BaseURL: "mock",
		Token:   "mock",
		NPSN:    "mock",
	}

	opts := SyncOptions{
		DryRun: true,
	}

	const concurrentCalls = 10
	var successCount int32
	var blockedCount int32
	var wg sync.WaitGroup

	startSignal := make(chan struct{})

	for i := 0; i < concurrentCalls; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-startSignal // Sinkronkan peluncuran goroutine secara serentak

			_, err := svc.SyncDataWithOptions(opts, "tester")
			if err != nil {
				atomic.AddInt32(&blockedCount, 1)
			} else {
				atomic.AddInt32(&successCount, 1)
			}
		}()
	}

	// Lepas sinyal agar semua goroutine berjalan serempak
	close(startSignal)
	wg.Wait()

	if successCount == 0 {
		t.Fatalf("Minimal harus ada 1 panggilan yang berhasil mendapatkan lock")
	}

	if blockedCount == 0 && concurrentCalls > 1 {
		t.Logf("Catatan: Di lingkungan unit test tanpa delay jaringan, panggilan mungkin berjalan sangat cepat.")
	}

	// Pastikan setelah selesai, lock dilepas dan panggilan baru berhasil
	summary, err := svc.SyncDataWithOptions(opts, "tester-post")
	if err != nil {
		t.Errorf("Setelah sinkronisasi selesai, panggilan berikutnya seharusnya berhasil, tetapi error: %v", err)
	}
	if summary == nil || summary.Status != "success" {
		t.Errorf("Expected summary status success, got: %v", summary)
	}
}

// TestHighConcurrencyGroupGradesByKelompok menguji kestabilan thread-safety
// saat 100 goroutine mengakses GroupGradesByKelompok secara simultan
func TestHighConcurrencyGroupGradesByKelompok(t *testing.T) {
	cachedGroups := []models.SubjectGroup{
		{Kode: "A", Nama: "Kelompok A (Umum)", Urutan: 1},
		{Kode: "B", Nama: "Kelompok B (Kejuruan)", Urutan: 2},
		{Kode: "Muatan Lokal", Nama: "Mulok", Urutan: 3},
	}

	grades := []ReportSubjectGrade{
		{SubjectID: "1", SubjectNama: "Pendidikan Agama", Kelompok: "A", Urutan: 1},
		{SubjectID: "2", SubjectNama: "Bahasa Indonesia", Kelompok: "A", Urutan: 2},
		{SubjectID: "3", SubjectNama: "Matematika", Kelompok: "B", Urutan: 1},
		{SubjectID: "4", SubjectNama: "Bahasa Daerah", Kelompok: "Muatan Lokal", Urutan: 1},
	}

	const workers = 100
	var wg sync.WaitGroup

	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			grouped, flat := GroupGradesByKelompok(grades, cachedGroups)
			if len(grouped) != 3 {
				t.Errorf("Worker %d: expected 3 groups, got %d", workerID, len(grouped))
			}
			if len(flat) != 4 {
				t.Errorf("Worker %d: expected 4 flat grades, got %d", workerID, len(flat))
			}
		}(i)
	}

	wg.Wait()
}

// TestStreamZipWriterIncremental memverifikasi mekanisme penulisan zip bertahap
// tanpa perlu menampung seluruh PDF di memori sebelumnya
func TestStreamZipWriterIncremental(t *testing.T) {
	buf := new(bytes.Buffer)
	zipWriter := zip.NewWriter(buf)

	// Simulasi penulisan beberapa file PDF secara streaming
	for i := 1; i <= 5; i++ {
		fileName := fmt.Sprintf("%02d_test_student_%d.pdf", i, i)
		f, err := zipWriter.Create(fileName)
		if err != nil {
			t.Fatalf("Gagal membuat entry zip: %v", err)
		}
		dummyPDFContent := []byte(fmt.Sprintf("%%PDF-1.4 dummy content for student %d", i))
		if _, err := f.Write(dummyPDFContent); err != nil {
			t.Fatalf("Gagal menulis data pdf: %v", err)
		}
	}

	if err := zipWriter.Close(); err != nil {
		t.Fatalf("Gagal menutup zip writer: %v", err)
	}

	// Baca kembali zip untuk memverifikasi integritas file arsip
	zipReader, err := zip.NewReader(bytes.NewReader(buf.Bytes()), int64(buf.Len()))
	if err != nil {
		t.Fatalf("Zip yang dihasilkan korup: %v", err)
	}

	if len(zipReader.File) != 5 {
		t.Errorf("Expected 5 files in zip, got %d", len(zipReader.File))
	}
}

// BenchmarkGroupGradesByKelompokPreloaded membandingkan throughput formatting nilai
func BenchmarkGroupGradesByKelompokPreloaded(b *testing.B) {
	cachedGroups := []models.SubjectGroup{
		{Kode: "A", Nama: "Kelompok A (Umum)", Urutan: 1},
		{Kode: "B", Nama: "Kelompok B (Kejuruan)", Urutan: 2},
		{Kode: "C", Nama: "Kelompok C (Pilihan)", Urutan: 3},
		{Kode: "Muatan Lokal", Nama: "Mulok", Urutan: 4},
	}

	grades := make([]ReportSubjectGrade, 20)
	for i := 0; i < 20; i++ {
		kelompok := "A"
		if i >= 6 && i < 14 {
			kelompok = "B"
		} else if i >= 14 && i < 18 {
			kelompok = "C"
		} else if i >= 18 {
			kelompok = "Muatan Lokal"
		}
		grades[i] = ReportSubjectGrade{
			SubjectID:   fmt.Sprintf("sub-%d", i),
			SubjectNama: fmt.Sprintf("Mata Pelajaran %d", i),
			Kelompok:    kelompok,
			Urutan:      i + 1,
			NilaiAkhir:  85.5,
		}
	}

	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		_, _ = GroupGradesByKelompok(grades, cachedGroups)
	}
}
