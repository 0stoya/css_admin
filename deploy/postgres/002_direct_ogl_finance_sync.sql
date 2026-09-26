BEGIN;

ALTER TABLE css_admin.company_order_finance_snapshot
  ALTER COLUMN company_id DROP NOT NULL;

ALTER TABLE css_admin.company_order_finance_snapshot
  ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'FLUID_GRAPHQL';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'company_order_finance_snapshot_cref_source_unique'
      AND conrelid = 'css_admin.company_order_finance_snapshot'::regclass
  ) THEN
    ALTER TABLE css_admin.company_order_finance_snapshot
      ADD CONSTRAINT company_order_finance_snapshot_cref_source_unique
      UNIQUE (cref, source_refreshed_at);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS company_order_finance_snapshot_cref_latest_idx
  ON css_admin.company_order_finance_snapshot
  (cref, source_refreshed_at DESC, captured_at DESC)
  WHERE cref IS NOT NULL;

CREATE TABLE IF NOT EXISTS css_admin.company_finance_sync_run (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'RUNNING',
  customers_discovered integer NOT NULL DEFAULT 0,
  companies_synced integer NOT NULL DEFAULT 0,
  companies_failed integer NOT NULL DEFAULT 0,
  error_sample jsonb NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT company_finance_sync_run_status_check
    CHECK (status IN ('RUNNING', 'PASS', 'PARTIAL', 'FAIL')),
  CONSTRAINT company_finance_sync_run_error_sample_array
    CHECK (jsonb_typeof(error_sample) = 'array')
);

CREATE INDEX IF NOT EXISTS company_finance_sync_run_started_idx
  ON css_admin.company_finance_sync_run (started_at DESC);

COMMIT;
