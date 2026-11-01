-- 000008_create_school_profiles.up.sql

CREATE TABLE IF NOT EXISTS school_profiles (
    id VARCHAR(64) PRIMARY KEY,
    nama_sekolah VARCHAR(255) NOT NULL,
    npsn VARCHAR(32) NOT NULL,
    nss VARCHAR(64),
    bentuk_pendidikan VARCHAR(32) DEFAULT 'SMK',
    status_sekolah VARCHAR(32) DEFAULT 'Negeri',
    alamat TEXT,
    desa_kelurahan VARCHAR(100),
    kecamatan VARCHAR(100),
    kabupaten_kota VARCHAR(100),
    provinsi VARCHAR(100),
    kode_pos VARCHAR(16),
    telepon VARCHAR(32),
    email VARCHAR(100),
    website VARCHAR(150),
    kop_baris_1 VARCHAR(255),
    kop_baris_2 VARCHAR(255),
    kop_baris_3 VARCHAR(255),
    logo_kiri TEXT,
    logo_kanan TEXT,
    kepala_sekolah_nama VARCHAR(255),
    kepala_sekolah_nip VARCHAR(64),
    titimangsa_tempat VARCHAR(100),
    tanggal_rapor_pts VARCHAR(64),
    tanggal_rapor_pas VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by VARCHAR(64)
);

INSERT INTO school_profiles (
    id, nama_sekolah, npsn, alamat, kabupaten_kota, provinsi, 
    kop_baris_1, kop_baris_2, titimangsa_tempat, kepala_sekolah_nama, kepala_sekolah_nip
) VALUES (
    'default',
    'SMK NEGERI 1 KOTA',
    '20108921',
    'Jl. Pendidikan No. 45, Kompleks Edukasi',
    'Jakarta',
    'DKI Jakarta',
    'PEMERINTAH PROVINSI DAERAH KHUSUS IBUKOTA JAKARTA',
    'DINAS PENDIDIKAN',
    'Jakarta',
    'Drs. H. Mulyadi, M.Pd.',
    '196805121994031004'
) ON CONFLICT (id) DO NOTHING;
