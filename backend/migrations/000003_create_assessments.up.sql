-- 000003_create_assessments.up.sql

CREATE TABLE IF NOT EXISTS grades (
    id VARCHAR(64) PRIMARY KEY,
    student_id VARCHAR(64) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject_id VARCHAR(64) NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    rombel_id VARCHAR(64) NOT NULL REFERENCES rombels(id) ON DELETE CASCADE,
    semester_id VARCHAR(64) NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    nilai_akhir NUMERIC(5,2) DEFAULT 0,
    deskripsi_capaian TEXT,
    input_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_student_subject_semester UNIQUE (student_id, subject_id, semester_id)
);

CREATE INDEX IF NOT EXISTS idx_grades_rombel_subject_sem ON grades (rombel_id, subject_id, semester_id);
CREATE INDEX IF NOT EXISTS idx_grades_student_sem ON grades (student_id, semester_id);

CREATE TABLE IF NOT EXISTS grade_details (
    id VARCHAR(64) PRIMARY KEY,
    grade_id VARCHAR(64) NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
    learning_objective_id VARCHAR(64) NOT NULL REFERENCES learning_objectives(id) ON DELETE CASCADE,
    nilai NUMERIC(5,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_grade_learning_objective UNIQUE (grade_id, learning_objective_id)
);

CREATE INDEX IF NOT EXISTS idx_grade_details_grade ON grade_details (grade_id);
CREATE INDEX IF NOT EXISTS idx_grade_details_tp ON grade_details (learning_objective_id);

CREATE TABLE IF NOT EXISTS attendances (
    id VARCHAR(64) PRIMARY KEY,
    student_id VARCHAR(64) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    rombel_id VARCHAR(64) NOT NULL REFERENCES rombels(id) ON DELETE CASCADE,
    semester_id VARCHAR(64) NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    sakit INTEGER NOT NULL DEFAULT 0,
    izin INTEGER NOT NULL DEFAULT 0,
    tanpa_keterangan INTEGER NOT NULL DEFAULT 0,
    input_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_student_semester_attendance UNIQUE (student_id, semester_id)
);

CREATE INDEX IF NOT EXISTS idx_attendances_rombel_sem ON attendances (rombel_id, semester_id);

CREATE TABLE IF NOT EXISTS extracurriculars (
    id VARCHAR(64) PRIMARY KEY,
    student_id VARCHAR(64) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    rombel_id VARCHAR(64) NOT NULL REFERENCES rombels(id) ON DELETE CASCADE,
    semester_id VARCHAR(64) NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    nama_ekskul VARCHAR(128) NOT NULL,
    predikat VARCHAR(32) NOT NULL,
    keterangan TEXT,
    input_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_extracurriculars_student ON extracurriculars (student_id, semester_id);
CREATE INDEX IF NOT EXISTS idx_extracurriculars_rombel ON extracurriculars (rombel_id, semester_id);

CREATE TABLE IF NOT EXISTS wali_kelas_notes (
    id VARCHAR(64) PRIMARY KEY,
    student_id VARCHAR(64) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    rombel_id VARCHAR(64) NOT NULL REFERENCES rombels(id) ON DELETE CASCADE,
    semester_id VARCHAR(64) NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    catatan TEXT NOT NULL,
    input_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_student_semester_wali_notes UNIQUE (student_id, semester_id)
);

CREATE INDEX IF NOT EXISTS idx_wali_notes_rombel_sem ON wali_kelas_notes (rombel_id, semester_id);
