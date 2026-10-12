-- Apply manually; never run schema changes at application startup.
BEGIN;
CREATE SCHEMA IF NOT EXISTS css_admin;
CREATE TABLE IF NOT EXISTS css_admin.export_job (
  id uuid PRIMARY KEY,
  owner_admin_user_id integer NOT NULL CHECK (owner_admin_user_id > 0),
  export_kind text NOT NULL DEFAULT 'company_structure_products'
    CHECK (export_kind = 'company_structure_products'),
  requested_company_id integer NOT NULL CHECK (requested_company_id > 0),
  root_company_id integer NOT NULL CHECK (root_company_id > 0),
  root_reference text NOT NULL,
  root_name text NOT NULL,
  company_ids integer[] NOT NULL CHECK (cardinality(company_ids) BETWEEN 2 AND 80),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'ready', 'failed', 'cancelled', 'expired')),
  completed_companies integer NOT NULL DEFAULT 0 CHECK (completed_companies >= 0),
  total_companies integer NOT NULL CHECK (total_companies BETWEEN 2 AND 80),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  run_after timestamptz NOT NULL DEFAULT now(),
  run_token uuid,
  lease_expires_at timestamptz,
  artifact_name text,
  artifact_bytes bigint,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  expires_at timestamptz,
  acknowledged_at timestamptz,
  CONSTRAINT export_job_company_count_matches CHECK (total_companies = cardinality(company_ids)),
  CONSTRAINT export_job_root_in_scope CHECK (root_company_id = ANY (company_ids)),
  CONSTRAINT export_job_ready_artifact
    CHECK (status <> 'ready' OR (artifact_name IS NOT NULL AND expires_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS export_job_owner_recent_idx
  ON css_admin.export_job (owner_admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS export_job_queue_idx
  ON css_admin.export_job (run_after, created_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS export_job_lease_idx
  ON css_admin.export_job (lease_expires_at) WHERE status = 'running';
CREATE INDEX IF NOT EXISTS export_job_expiry_idx
  ON css_admin.export_job (expires_at) WHERE status = 'ready';
COMMIT;
