-- 000010_scope_learning_objectives_to_teacher.down.sql

DROP INDEX IF EXISTS idx_learning_objectives_guru_subject;
DROP INDEX IF EXISTS uq_guru_subject_kode_tp;

-- Kembalikan unique constraint lama jika memungkinkan
ALTER TABLE learning_objectives 
ADD CONSTRAINT uq_subject_kode_tp UNIQUE (subject_id, kode_tp);

ALTER TABLE learning_objectives 
DROP COLUMN IF EXISTS guru_id;
