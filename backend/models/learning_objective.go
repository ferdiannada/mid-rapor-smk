package models

import (
	"time"
)

type LearningObjective struct {
	ID        string    `gorm:"primaryKey;type:varchar(64)" json:"id"`
	SubjectID string    `gorm:"not null;index" json:"subject_id"`
	Subject   *Subject  `gorm:"foreignKey:SubjectID;references:ID" json:"subject,omitempty"`
	KodeTP    string    `gorm:"not null;type:varchar(32)" json:"kode_tp"`
	Deskripsi string    `gorm:"not null;type:text" json:"deskripsi"`
	Urutan    int       `gorm:"default:1" json:"urutan"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
