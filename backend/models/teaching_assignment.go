package models

import (
	"time"
)

type TeachingAssignment struct {
	ID                    string    `gorm:"primaryKey;type:varchar(64)" json:"id"` // UUID
	GuruID                string    `gorm:"not null;index" json:"guru_id"`
	Guru                  *User     `gorm:"foreignKey:GuruID;references:ID" json:"guru,omitempty"`
	SubjectID             string    `gorm:"not null;index" json:"subject_id"`
	Subject               *Subject  `gorm:"foreignKey:SubjectID;references:ID" json:"subject,omitempty"`
	RombelID              string    `gorm:"not null;index" json:"rombel_id"`
	Rombel                *Rombel   `gorm:"foreignKey:RombelID;references:ID" json:"rombel,omitempty"`
	SemesterID            string    `gorm:"index" json:"semester_id"`
	DapodikPembelajaranID string    `gorm:"index" json:"dapodik_pembelajaran_id"`
	JamPerMinggu          int       `json:"jam_per_minggu"`
	DapodikDataHash       string    `json:"dapodik_data_hash"`
	IsManualOverride      bool      `gorm:"default:false" json:"is_manual_override"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}
