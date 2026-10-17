package models

import (
	"time"
)

type UserRole string

const (
	RoleAdmin UserRole = "admin"
	RoleGuru  UserRole = "guru"
)

type User struct {
	ID                  string     `gorm:"primaryKey;type:varchar(64)" json:"id"` // ptk_id dari Dapodik atau UUID untuk admin
	Name                string     `gorm:"not null" json:"name"`
	Email               string     `gorm:"uniqueIndex;not null" json:"email"`
	PasswordHash        string     `gorm:"not null" json:"-"`
	Role                UserRole   `gorm:"not null;default:'guru'" json:"role"`
	NipNik              string     `gorm:"uniqueIndex" json:"nip_nik"`
	Phone               string     `json:"phone"`
	DapodikID           string     `gorm:"index" json:"dapodik_id"`
	DapodikDataHash     string     `json:"dapodik_data_hash"`
	DapodikLastSyncedAt *time.Time `json:"dapodik_last_synced_at"`
	IsInitialPassword   bool       `gorm:"default:true" json:"is_initial_password"`
	IsManualOverride    bool       `gorm:"default:false" json:"is_manual_override"`
	IsActive            bool       `gorm:"default:true" json:"is_active"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
}
