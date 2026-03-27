-- Physician Collaboration Network Tables
-- Phase 2: oncology provider HCPCS profiles (from Part B re-processing)
-- and group practice affiliations (from CMS DAC file)

-- Per-provider oncology HCPCS profiles (aggregated from Medicare Part B)
-- One row per NPI per year — stores their full HCPCS code set as an array
CREATE TABLE IF NOT EXISTS oncology_provider_profiles (
  id          BIGSERIAL PRIMARY KEY,
  year        INT          NOT NULL,
  npi         TEXT         NOT NULL,
  provider_name   TEXT,
  provider_city   TEXT,
  provider_state  TEXT,
  provider_zip    TEXT,
  provider_type   TEXT,
  total_services  NUMERIC  DEFAULT 0,
  bene_unique_cnt NUMERIC  DEFAULT 0,
  hcpcs_codes     TEXT[]   DEFAULT '{}'
);

CREATE UNIQUE INDEX IF NOT EXISTS oncology_provider_profiles_year_npi
  ON oncology_provider_profiles (year, npi);
CREATE INDEX IF NOT EXISTS oncology_provider_profiles_npi
  ON oncology_provider_profiles (npi);
CREATE INDEX IF NOT EXISTS oncology_provider_profiles_state
  ON oncology_provider_profiles (provider_state);
-- GIN index enables fast array overlap queries (&& operator)
CREATE INDEX IF NOT EXISTS oncology_provider_profiles_hcpcs_gin
  ON oncology_provider_profiles USING GIN (hcpcs_codes);

ALTER TABLE oncology_provider_profiles DISABLE ROW LEVEL SECURITY;

-- Physician group practice affiliations (from CMS Doctors and Clinicians file)
-- Enables same-group detection (strongest collaboration signal)
CREATE TABLE IF NOT EXISTS physician_group_affiliations (
  id            BIGSERIAL PRIMARY KEY,
  npi           TEXT  NOT NULL,
  provider_name TEXT,
  specialty     TEXT,
  group_pac_id  TEXT,      -- CMS group PAC ID — same ID = same group practice
  group_name    TEXT,
  provider_city TEXT,
  provider_state TEXT,
  provider_zip  TEXT,
  credentials   TEXT
);

CREATE INDEX IF NOT EXISTS physician_group_affiliations_npi
  ON physician_group_affiliations (npi);
CREATE INDEX IF NOT EXISTS physician_group_affiliations_group_pac_id
  ON physician_group_affiliations (group_pac_id);
CREATE INDEX IF NOT EXISTS physician_group_affiliations_state
  ON physician_group_affiliations (provider_state);

ALTER TABLE physician_group_affiliations DISABLE ROW LEVEL SECURITY;
