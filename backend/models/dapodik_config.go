package models

import (
	"time"
)

type DapodikConfig struct {
	ID             string    `gorm:"primaryKey;type:varchar(64)" json:"id"`
	Name           string    `gorm:"not null;default:'Koneksi Dapodik'" json:"name"`
	DapodikHost    string    `gorm:"not null;default:'localhost'" json:"dapodik_host"`
	DapodikPort    int       `gorm:"not null;default:5774" json:"dapodik_port"`
	DapodikToken   string    `gorm:"not null;uniqueIndex" json:"-"`
	Npsn           string    `gorm:"not null;size:16" json:"npsn"`
	TimeoutSeconds int       `gorm:"default:10" json:"timeout_seconds"`
	IsActive       bool      `gorm:"default:true" json:"is_active"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
	UpdatedBy      string    `json:"updated_by"`
}
