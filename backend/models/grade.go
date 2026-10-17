package models

import (
	"time"
)

type Grade struct {
	ID               string        `gorm:"primaryKey;type:varchar(64)" json:"id"`
	StudentID        string        `gorm:"not null;index" json:"student_id"`
	Student          *Student      `gorm:"foreignKey:StudentID;references:ID" json:"student,omitempty"`
	SubjectID        string        `gorm:"not null;index" json:"subject_id"`
	Subject          *Subject      `gorm:"foreignKey:SubjectID;references:ID" json:"subject,omitempty"`
	RombelID         string        `gorm:"not null;index" json:"rombel_id"`
	Rombel           *Rombel       `gorm:"foreignKey:RombelID;references:ID" json:"rombel,omitempty"`
	SemesterID       string        `gorm:"not null;index" json:"semester_id"`
	Semester         *Semester     `gorm:"foreignKey:SemesterID;references:ID" json:"semester,omitempty"`
	NilaiAkhir       float64       `gorm:"type:numeric(5,2);default:0" json:"nilai_akhir"`
	DeskripsiCapaian string        `gorm:"type:text" json:"deskripsi_capaian"`
	InputBy          *string       `gorm:"type:varchar(64)" json:"input_by,omitempty"`
	InputUser        *User         `gorm:"foreignKey:InputBy;references:ID" json:"input_user,omitempty"`
	GradeDetails     []GradeDetail `gorm:"foreignKey:GradeID;references:ID" json:"grade_details,omitempty"`
	CreatedAt        time.Time     `json:"created_at"`
	UpdatedAt        time.Time     `json:"updated_at"`
}

type GradeDetail struct {
	ID                  string             `gorm:"primaryKey;type:varchar(64)" json:"id"`
	GradeID             string             `gorm:"not null;index" json:"grade_id"`
	LearningObjectiveID string             `gorm:"not null;index" json:"learning_objective_id"`
	LearningObjective   *LearningObjective `gorm:"foreignKey:LearningObjectiveID;references:ID" json:"learning_objective,omitempty"`
	Nilai               float64            `gorm:"type:numeric(5,2);default:0" json:"nilai"`
	CreatedAt           time.Time          `json:"created_at"`
	UpdatedAt           time.Time          `json:"updated_at"`
}

type Attendance struct {
	ID              string    `gorm:"primaryKey;type:varchar(64)" json:"id"`
	StudentID       string    `gorm:"not null;index" json:"student_id"`
	Student         *Student  `gorm:"foreignKey:StudentID;references:ID" json:"student,omitempty"`
	RombelID        string    `gorm:"not null;index" json:"rombel_id"`
	Rombel          *Rombel   `gorm:"foreignKey:RombelID;references:ID" json:"rombel,omitempty"`
	SemesterID      string    `gorm:"not null;index" json:"semester_id"`
	Semester        *Semester `gorm:"foreignKey:SemesterID;references:ID" json:"semester,omitempty"`
	Sakit           int       `gorm:"default:0" json:"sakit"`
	Izin            int       `gorm:"default:0" json:"izin"`
	TanpaKeterangan int       `gorm:"default:0" json:"tanpa_keterangan"`
	InputBy         *string   `gorm:"type:varchar(64)" json:"input_by,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type Extracurricular struct {
	ID         string    `gorm:"primaryKey;type:varchar(64)" json:"id"`
	StudentID  string    `gorm:"not null;index" json:"student_id"`
	Student    *Student  `gorm:"foreignKey:StudentID;references:ID" json:"student,omitempty"`
	RombelID   string    `gorm:"not null;index" json:"rombel_id"`
	Rombel     *Rombel   `gorm:"foreignKey:RombelID;references:ID" json:"rombel,omitempty"`
	SemesterID string    `gorm:"not null;index" json:"semester_id"`
	Semester   *Semester `gorm:"foreignKey:SemesterID;references:ID" json:"semester,omitempty"`
	NamaEkskul string    `gorm:"type:varchar(128);not null" json:"nama_ekskul"`
	Predikat   string    `gorm:"type:varchar(32);not null" json:"predikat"`
	Keterangan string    `gorm:"type:text" json:"keterangan"`
	InputBy    *string   `gorm:"type:varchar(64)" json:"input_by,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type WaliKelasNote struct {
	ID         string    `gorm:"primaryKey;type:varchar(64)" json:"id"`
	StudentID  string    `gorm:"not null;index" json:"student_id"`
	Student    *Student  `gorm:"foreignKey:StudentID;references:ID" json:"student,omitempty"`
	RombelID   string    `gorm:"not null;index" json:"rombel_id"`
	Rombel     *Rombel   `gorm:"foreignKey:RombelID;references:ID" json:"rombel,omitempty"`
	SemesterID string    `gorm:"not null;index" json:"semester_id"`
	Semester   *Semester `gorm:"foreignKey:SemesterID;references:ID" json:"semester,omitempty"`
	Catatan    string    `gorm:"type:text;not null" json:"catatan"`
	InputBy    *string   `gorm:"type:varchar(64)" json:"input_by,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}
