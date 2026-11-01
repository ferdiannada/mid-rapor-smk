-- 000009_fix_teaching_assignments_unique_constraint.down.sql

DROP INDEX IF EXISTS uq_teaching_assignment_coalesce;

ALTER TABLE teaching_assignments 
ADD CONSTRAINT uq_teaching_assignment UNIQUE (guru_id, subject_id, rombel_id, semester_id);
