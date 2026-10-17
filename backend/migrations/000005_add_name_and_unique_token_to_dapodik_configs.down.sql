-- 000005_add_name_and_unique_token_to_dapodik_configs.down.sql

DROP INDEX IF EXISTS idx_dapodik_configs_token;
ALTER TABLE dapodik_configs DROP COLUMN IF EXISTS name;
