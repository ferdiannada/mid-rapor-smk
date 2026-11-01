package models

import (
	"time"
)

type Subject struct {
	ID               string    `gorm:"primaryKey;type:varchar(64)" json:"id"` // UUID atau slug
	DapodikMapelID   int       `gorm:"index" json:"dapodik_mapel_id"`
	Nama             string    `gorm:"not null" json:"nama"`
	Kelompok         string    `json:"kelompok"` // A (Umum), B (Kejuruan), dll
	Urutan           int       `gorm:"default:0" json:"urutan"`
	DapodikDataHash  string    `json:"dapodik_data_hash"`
	IsManualOverride bool      `gorm:"default:false" json:"is_manual_override"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}
