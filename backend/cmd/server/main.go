package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"golang.org/x/crypto/bcrypt"
	"rapor-smk-backend/config"
	"rapor-smk-backend/models"
	"rapor-smk-backend/routes"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Gagal memuat konfigurasi aplikasi: %v", err)
	}

	log.Printf("Memulai %s (Mode: %s)...", cfg.AppName, cfg.AppEnv)

	// Inisialisasi Database PostgreSQL
	config.InitDB(cfg)

	// Inisialisasi Redis Cache
	config.InitRedis(cfg)

	// Seed Admin User jika belum ada
	seedAdminUser()

	// Seed Profil Identitas Sekolah jika belum ada
	seedSchoolProfile()

	// Inisialisasi Router
	router := routes.SetupRouter(cfg)

	addr := fmt.Sprintf(":%d", cfg.Port)

	// Konfigurasi HTTP server tangguh untuk beban konkurensi tinggi
	srv := &http.Server{
		Addr:              addr,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,  // Mencegah serangan Slowloris
		ReadTimeout:       15 * time.Second, // Timeout pembacaan request
		WriteTimeout:      120 * time.Second, // Waktu cukup untuk streaming file ZIP/PDF
		IdleTimeout:       120 * time.Second, // Keepalive pool
		MaxHeaderBytes:    1 << 20,          // 1 MB batas header
	}

	// Jalankan server di goroutine
	go func() {
		log.Printf("Server siap berjalan pada http://localhost%s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server berhenti dengan error: %v", err)
		}
	}()

	// Menunggu sinyal OS untuk Graceful Shutdown (mencegah pemutusan koneksi saat reload)
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Menerima sinyal shutdown, mematikan server secara anggun...")

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server dipaksa berhenti: %v", err)
	}

	log.Println("Server berhasil dimatikan dengan aman tanpa memutus transaksi aktif.")
}

func seedAdminUser() {
	db := config.DB
	if db == nil {
		return
	}

	var count int64
	db.Model(&models.User{}).Where("role = ?", models.RoleAdmin).Count(&count)
	if count == 0 {
		hash, err := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
		if err != nil {
			log.Fatalf("Gagal membuat hash password admin default: %v", err)
		}

		admin := models.User{
			ID:                  "admin-root",
			Name:                "Administrator Rapor",
			Email:               "admin@smk.sch.id",
			PasswordHash:        string(hash),
			Role:                models.RoleAdmin,
			NipNik:              "admin",
			Phone:               "081234567890",
			IsInitialPassword:   false,
			CreatedAt:           time.Now(),
			UpdatedAt:           time.Now(),
		}

		if err := db.Create(&admin).Error; err != nil {
			log.Printf("Warning: Gagal membuat admin default: %v", err)
		} else {
			log.Println("Admin default berhasil dibuat: NIP/NIK='admin' atau Email='admin@smk.sch.id', Password='admin123'")
		}
	}
}

func seedSchoolProfile() {
	db := config.DB
	if db == nil {
		return
	}

	_ = db.AutoMigrate(&models.SchoolProfile{})

	var count int64
	db.Model(&models.SchoolProfile{}).Count(&count)
	if count == 0 {
		defaultProfile := models.SchoolProfile{
			ID:                "default",
			NamaSekolah:       "SMK NEGERI 1 KOTA",
			NPSN:              "20108921",
			BentukPendidikan:  "SMK",
			StatusSekolah:     "Negeri",
			Alamat:            "Jl. Pendidikan No. 45, Kompleks Edukasi",
			KabupatenKota:     "Jakarta",
			Provinsi:          "DKI Jakarta",
			KopBaris1:         "PEMERINTAH PROVINSI DAERAH KHUSUS IBUKOTA JAKARTA",
			KopBaris2:         "DINAS PENDIDIKAN",
			KepalaSekolahNama: "Drs. H. Mulyadi, M.Pd.",
			KepalaSekolahNIP:  "196805121994031004",
			TitimangsaTempat:  "Jakarta",
			CreatedAt:         time.Now(),
			UpdatedAt:         time.Now(),
		}
		if err := db.Create(&defaultProfile).Error; err != nil {
			log.Printf("Warning: Gagal seed profil sekolah default: %v", err)
		} else {
			log.Println("Profil identitas sekolah default berhasil dibuat.")
		}
	}
}
