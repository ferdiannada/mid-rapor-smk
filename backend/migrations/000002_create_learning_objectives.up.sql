-- 000002_create_learning_objectives.up.sql

CREATE TABLE IF NOT EXISTS learning_objectives (
    id VARCHAR(64) PRIMARY KEY,
    subject_id VARCHAR(64) NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    kode_tp VARCHAR(32) NOT NULL,
    deskripsi TEXT NOT NULL,
    urutan INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_subject_kode_tp UNIQUE (subject_id, kode_tp)
);

CREATE INDEX IF NOT EXISTS idx_learning_objectives_subject ON learning_objectives (subject_id);
