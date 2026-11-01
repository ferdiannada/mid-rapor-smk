-- 000010_scope_learning_objectives_to_teacher.up.sql

-- 1. Tambahkan kolom guru_id pada learning_objectives yang berelasi ke users(id)
ALTER TABLE learning_objectives 
ADD COLUMN IF NOT EXISTS guru_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE;

-- 2. Drop unique constraint lama (subject_id, kode_tp) yang membatasi 1 kode_tp per mapel secara global
ALTER TABLE learning_objectives 
DROP CONSTRAINT IF EXISTS uq_subject_kode_tp;

-- 3. Buat functional unique index baru mencakup guru_id, sehingga tiap guru dapat membuat kode_tp (misal TP-1.1) secara independen.
-- Nilai NULL atau string kosong ('') diperlakukan sebagai 'GLOBAL' (TP bawaan kurikulum/admin).
CREATE UNIQUE INDEX IF NOT EXISTS uq_guru_subject_kode_tp 
ON learning_objectives (COALESCE(NULLIF(guru_id, ''), 'GLOBAL'), subject_id, kode_tp);

-- 4. Tambahkan index untuk optimasi pencarian TP berdasarkan guru dan mata pelajaran
CREATE INDEX IF NOT EXISTS idx_learning_objectives_guru_subject 
ON learning_objectives (guru_id, subject_id);
