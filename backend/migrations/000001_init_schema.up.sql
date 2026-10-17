-- 000001_init_schema.up.sql

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'guru',
    nip_nik VARCHAR(64) UNIQUE,
    phone VARCHAR(32),
    dapodik_id VARCHAR(64),
    dapodik_data_hash VARCHAR(64),
    dapodik_last_synced_at TIMESTAMPTZ,
    is_initial_password BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dapodik_configs (
    id VARCHAR(64) PRIMARY KEY,
    dapodik_host VARCHAR(255) NOT NULL DEFAULT 'localhost',
    dapodik_port INTEGER NOT NULL DEFAULT 5774,
    dapodik_token TEXT NOT NULL,
    npsn VARCHAR(16) NOT NULL,
    timeout_seconds INTEGER DEFAULT 10,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by VARCHAR(64)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dapodik_configs_active 
    ON dapodik_configs (is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS rombels (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    tingkat INTEGER NOT NULL,
    wali_kelas_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    dapodik_data_hash VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    nisn VARCHAR(32),
    nis VARCHAR(32),
    rombel_id VARCHAR(64) REFERENCES rombels(id) ON DELETE CASCADE,
    jenis_kelamin VARCHAR(10),
    tempat_lahir VARCHAR(100),
    tanggal_lahir VARCHAR(32),
    dapodik_id VARCHAR(64),
    dapodik_data_hash VARCHAR(64),
    dapodik_last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subjects (
    id VARCHAR(64) PRIMARY KEY,
    dapodik_mapel_id INTEGER,
    nama VARCHAR(255) NOT NULL,
    kelompok VARCHAR(64),
    dapodik_data_hash VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS semesters (
    id VARCHAR(64) PRIMARY KEY,
    tahun_ajaran VARCHAR(32) NOT NULL,
    semester INTEGER NOT NULL,
    jenis_rapor VARCHAR(32) NOT NULL DEFAULT 'mid',
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teaching_assignments (
    id VARCHAR(64) PRIMARY KEY,
    guru_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id VARCHAR(64) NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    rombel_id VARCHAR(64) NOT NULL REFERENCES rombels(id) ON DELETE CASCADE,
    semester_id VARCHAR(64),
    dapodik_pembelajaran_id VARCHAR(64),
    jam_per_minggu INTEGER DEFAULT 0,
    dapodik_data_hash VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_teaching_assignment UNIQUE (guru_id, subject_id, rombel_id, semester_id)
);
