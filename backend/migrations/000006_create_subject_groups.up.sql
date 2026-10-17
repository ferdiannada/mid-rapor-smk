-- 000006_create_subject_groups.up.sql

CREATE TABLE IF NOT EXISTS subject_groups (
    kode VARCHAR(64) PRIMARY KEY,
    nama VARCHAR(255) NOT NULL,
    deskripsi TEXT,
    urutan INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO subject_groups (kode, nama, deskripsi, urutan) VALUES
('A', 'Kelompok A (Muatan Umum)', 'Mata pelajaran wajib nasional (Pendidikan Agama, Pendidikan Pancasila, Bahasa Indonesia, PJOK, Sejarah, Seni Budaya).', 1),
('B', 'Kelompok B (Muatan Kejuruan)', 'Mata pelajaran kejuruan (Matematika, Bahasa Inggris, Informatika, Projek IPAS, Dasar Program Keahlian, Konsentrasi Keahlian, PKK, PKL).', 2),
('C', 'Kelompok C (Konsentrasi / Pilihan)', 'Mata pelajaran pilihan atau konsentrasi keahlian spesifik program studi.', 3),
('Muatan Lokal', 'Muatan Lokal (Mulok)', 'Mata pelajaran kearifan lokal daerah atau bahasa daerah.', 4)
ON CONFLICT (kode) DO NOTHING;
