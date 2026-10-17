package models

import (
	"time"
)

type Rombel struct {
	ID              string    `gorm:"primaryKey;type:varchar(64)" json:"id"` // rombongan_belajar_id dari Dapodik
	Name            string    `gorm:"not null" json:"name"`
	Tingkat         int       `gorm:"not null" json:"tingkat"` // 10, 11, 12
	WaliKelasID     string    `gorm:"index" json:"wali_kelas_id"`
	WaliKelas       *User     `gorm:"foreignKey:WaliKelasID;references:ID" json:"wali_kelas,omitempty"`
	DapodikDataHash  string    `json:"dapodik_data_hash"`
	IsManualOverride bool      `gorm:"default:false" json:"is_manual_override"`
	StudentCount     int64     `gorm:"-" json:"student_count"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}
