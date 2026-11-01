-- 000011_add_manual_override_and_active_flags.down.sql

DROP INDEX IF EXISTS idx_students_is_active;
DROP INDEX IF EXISTS idx_users_is_active;

ALTER TABLE teaching_assignments DROP COLUMN IF EXISTS is_manual_override;
ALTER TABLE subjects DROP COLUMN IF EXISTS is_manual_override;
ALTER TABLE rombels DROP COLUMN IF EXISTS is_manual_override;
ALTER TABLE students DROP COLUMN IF EXISTS is_active;
ALTER TABLE students DROP COLUMN IF EXISTS is_manual_override;
ALTER TABLE users DROP COLUMN IF EXISTS is_active;
ALTER TABLE users DROP COLUMN IF EXISTS is_manual_override;
