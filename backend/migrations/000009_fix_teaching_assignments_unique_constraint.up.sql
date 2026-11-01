-- 000009_fix_teaching_assignments_unique_constraint.up.sql

-- 1. Hapus constraint lama yang tidak menganggap nilai NULL sebagai duplikasi
ALTER TABLE teaching_assignments DROP CONSTRAINT IF EXISTS uq_teaching_assignment;

-- 2. Bersihkan duplikasi yang mungkin sudah terlanjur tersimpan karena constraint lama
DELETE FROM teaching_assignments a USING teaching_assignments b
WHERE a.id > b.id
  AND a.guru_id = b.guru_id
  AND a.subject_id = b.subject_id
  AND a.rombel_id = b.rombel_id
  AND COALESCE(NULLIF(a.semester_id, ''), 'GENERAL') = COALESCE(NULLIF(b.semester_id, ''), 'GENERAL');

-- 3. Buat functional unique index yang menjamin keunikan meski semester_id NULL atau kosong ('')
CREATE UNIQUE INDEX IF NOT EXISTS uq_teaching_assignment_coalesce 
ON teaching_assignments (guru_id, subject_id, rombel_id, COALESCE(NULLIF(semester_id, ''), 'GENERAL'));
