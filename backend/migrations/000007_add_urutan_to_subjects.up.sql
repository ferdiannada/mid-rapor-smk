-- 000007_add_urutan_to_subjects.up.sql

ALTER TABLE subjects ADD COLUMN IF NOT EXISTS urutan INT DEFAULT 0;

-- Berikan nomor urut awal berdasarkan abjad nama mata pelajaran per kelompok
WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY COALESCE(kelompok, '') ORDER BY nama ASC) AS r_num
    FROM subjects
)
UPDATE subjects
SET urutan = ordered.r_num
FROM ordered
WHERE subjects.id = ordered.id;

CREATE INDEX IF NOT EXISTS idx_subjects_kelompok_urutan ON subjects(kelompok, urutan);
