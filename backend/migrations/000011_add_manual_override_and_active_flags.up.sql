-- 000011_add_manual_override_and_active_flags.up.sql

-- 1. Tambahkan kolom is_manual_override dan is_active pada tabel users (Guru & Tenaga Kependidikan)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_manual_override BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active);

-- 2. Tambahkan kolom is_manual_override dan is_active pada tabel students (Peserta Didik)
ALTER TABLE students ADD COLUMN IF NOT EXISTS is_manual_override BOOLEAN DEFAULT false;
ALTER TABLE students ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_students_is_active ON students (is_active);

-- 3. Tambahkan kolom is_manual_override pada tabel rombels (Rombongan Belajar)
ALTER TABLE rombels ADD COLUMN IF NOT EXISTS is_manual_override BOOLEAN DEFAULT false;

-- 4. Tambahkan kolom is_manual_override pada tabel subjects (Mata Pelajaran)
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS is_manual_override BOOLEAN DEFAULT false;

-- 5. Tambahkan kolom is_manual_override pada tabel teaching_assignments (Penugasan Mengajar)
ALTER TABLE teaching_assignments ADD COLUMN IF NOT EXISTS is_manual_override BOOLEAN DEFAULT false;
