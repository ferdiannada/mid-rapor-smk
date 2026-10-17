-- 000004_add_performance_indexes.up.sql

-- 1. Indeks pada students(rombel_id) - meniadakan Seq Scan saat filtering siswa per kelas
CREATE INDEX IF NOT EXISTS idx_students_rombel_id ON students (rombel_id);

-- 2. Indeks pada teaching_assignments(rombel_id) dan (guru_id)
CREATE INDEX IF NOT EXISTS idx_teaching_assignments_rombel ON teaching_assignments (rombel_id);
CREATE INDEX IF NOT EXISTS idx_teaching_assignments_guru ON teaching_assignments (guru_id);

-- 3. Partial unique index pada semesters(is_active) where is_active = true
-- Menjamin hanya boleh ada tepat 1 semester aktif di seluruh sistem
CREATE UNIQUE INDEX IF NOT EXISTS idx_semesters_active ON semesters (is_active) WHERE is_active = true;

-- 4. Functional index untuk pencarian email case-insensitive saat login
CREATE INDEX IF NOT EXISTS idx_users_lower_email ON users (LOWER(email));
