package models

import "time"

type SubjectGroup struct {
	Kode      string    `gorm:"primaryKey;type:varchar(64)" json:"kode"`
	Nama      string    `gorm:"not null;type:varchar(255)" json:"nama"`
	Deskripsi string    `gorm:"type:text" json:"deskripsi"`
	Urutan    int       `gorm:"default:0" json:"urutan"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
