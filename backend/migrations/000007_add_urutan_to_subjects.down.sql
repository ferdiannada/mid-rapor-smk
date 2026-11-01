-- 000007_add_urutan_to_subjects.down.sql

DROP INDEX IF EXISTS idx_subjects_kelompok_urutan;
ALTER TABLE subjects DROP COLUMN IF EXISTS urutan;
