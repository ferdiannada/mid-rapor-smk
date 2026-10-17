package models

import (
	"time"
)

type Student struct {
	ID                  string     `gorm:"primaryKey;type:varchar(64)" json:"id"` // peserta_didik_id dari Dapodik
	Name                string     `gorm:"not null" json:"name"`
	Nisn                string     `gorm:"index" json:"nisn"`
	Nis                 string     `json:"nis"`
	RombelID            string     `gorm:"index;type:varchar(64)" json:"rombel_id"`
	Rombel              *Rombel    `gorm:"foreignKey:RombelID;references:ID" json:"rombel,omitempty"`
	JenisKelamin        string     `json:"jenis_kelamin"` // L / P
	TempatLahir         string     `json:"tempat_lahir"`
	TanggalLahir        string     `json:"tanggal_lahir"` // YYYY-MM-DD
	DapodikID           string     `gorm:"index" json:"dapodik_id"`
	DapodikDataHash     string     `json:"dapodik_data_hash"`
	DapodikLastSyncedAt *time.Time `json:"dapodik_last_synced_at"`
	IsManualOverride    bool       `gorm:"default:false" json:"is_manual_override"`
	IsActive            bool       `gorm:"default:true" json:"is_active"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
}
