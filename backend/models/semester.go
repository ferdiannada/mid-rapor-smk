package models

import (
	"time"
)

type Semester struct {
	ID          string    `gorm:"primaryKey;type:varchar(64)" json:"id"` // UUID
	TahunAjaran string    `gorm:"not null" json:"tahun_ajaran"`          // contoh: "2024/2025"
	Semester    int       `gorm:"not null" json:"semester"`              // 1 (Ganjil) atau 2 (Genap)
	JenisRapor  string    `gorm:"not null;default:'mid'" json:"jenis_rapor"` // "mid" atau "akhir"
	IsActive    bool      `gorm:"default:false" json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
