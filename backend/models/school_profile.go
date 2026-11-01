package models

import (
	"time"
)

type SchoolProfile struct {
	ID                string    `gorm:"primaryKey;type:varchar(64)" json:"id"`
	NamaSekolah       string    `gorm:"not null;type:varchar(255)" json:"nama_sekolah"`
	NPSN              string    `gorm:"not null;type:varchar(32)" json:"npsn"`
	NSS               string    `gorm:"type:varchar(64)" json:"nss"`
	BentukPendidikan  string    `gorm:"type:varchar(32);default:'SMK'" json:"bentuk_pendidikan"`
	StatusSekolah     string    `gorm:"type:varchar(32);default:'Negeri'" json:"status_sekolah"`
	Alamat            string    `gorm:"type:text" json:"alamat"`
	DesaKelurahan     string    `gorm:"type:varchar(100)" json:"desa_kelurahan"`
	Kecamatan         string    `gorm:"type:varchar(100)" json:"kecamatan"`
	KabupatenKota     string    `gorm:"type:varchar(100)" json:"kabupaten_kota"`
	Provinsi          string    `gorm:"type:varchar(100)" json:"provinsi"`
	KodePos           string    `gorm:"type:varchar(16)" json:"kode_pos"`
	Telepon           string    `gorm:"type:varchar(32)" json:"telepon"`
	Email             string    `gorm:"type:varchar(100)" json:"email"`
	Website           string    `gorm:"type:varchar(150)" json:"website"`

	// Kop Surat Rapor
	KopBaris1         string    `gorm:"type:varchar(255)" json:"kop_baris_1"`
	KopBaris2         string    `gorm:"type:varchar(255)" json:"kop_baris_2"`
	KopBaris3         string    `gorm:"type:varchar(255)" json:"kop_baris_3"`

	// Logo (Base64 data URL atau URL gambar)
	LogoKiri          string    `gorm:"type:text" json:"logo_kiri"`
	LogoKanan         string    `gorm:"type:text" json:"logo_kanan"`

	// Kepala Sekolah untuk Tanda Tangan Rapor
	KepalaSekolahNama string    `gorm:"type:varchar(255)" json:"kepala_sekolah_nama"`
	KepalaSekolahNIP  string    `gorm:"type:varchar(64)" json:"kepala_sekolah_nip"`

	// Titimangsa & Pengaturan Cetak Rapor
	TitimangsaTempat  string    `gorm:"type:varchar(100)" json:"titimangsa_tempat"`
	TanggalRaporPTS   string    `gorm:"type:varchar(64)" json:"tanggal_rapor_pts"`
	TanggalRaporPAS   string    `gorm:"type:varchar(64)" json:"tanggal_rapor_pas"`

	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
	UpdatedBy         string    `gorm:"type:varchar(64)" json:"updated_by"`
}
