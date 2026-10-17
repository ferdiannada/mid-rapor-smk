-- 000004_add_performance_indexes.down.sql

DROP INDEX IF EXISTS idx_students_rombel_id;
DROP INDEX IF EXISTS idx_teaching_assignments_rombel;
DROP INDEX IF EXISTS idx_teaching_assignments_guru;
DROP INDEX IF EXISTS idx_semesters_active;
DROP INDEX IF EXISTS idx_users_lower_email;
