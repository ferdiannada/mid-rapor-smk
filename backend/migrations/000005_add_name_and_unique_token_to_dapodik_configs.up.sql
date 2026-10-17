-- 000005_add_name_and_unique_token_to_dapodik_configs.up.sql

ALTER TABLE dapodik_configs ADD COLUMN IF NOT EXISTS name VARCHAR(100) DEFAULT 'Koneksi Dapodik' NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_dapodik_configs_token ON dapodik_configs (dapodik_token);
