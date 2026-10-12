-- PR #137: Staff export-ready Web Push. Apply explicitly after backup.
-- Existing export queue, worker, file storage and access checks stay unchanged.
BEGIN;

CREATE TABLE IF NOT EXISTS css_admin.staff_push_subscription (
  id uuid PRIMARY KEY,
  owner_admin_user_id integer NOT NULL CHECK (owner_admin_user_id > 0),
  device_id uuid NOT NULL UNIQUE,
  endpoint_hash char(64) NOT NULL UNIQUE,
  sealed_subscription text NOT NULL CHECK (char_length(sealed_subscription) BETWEEN 32 AND 8192),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS staff_push_subscription_owner_idx
  ON css_admin.staff_push_subscription (owner_admin_user_id, expires_at);

CREATE TABLE IF NOT EXISTS css_admin.staff_push_delivery (
  job_id uuid NOT NULL REFERENCES css_admin.export_job(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES css_admin.staff_push_subscription(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sending','sent','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 10),
  run_after timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  last_error_code text,
  PRIMARY KEY (job_id, subscription_id)
);
CREATE INDEX IF NOT EXISTS staff_push_delivery_queue_idx
  ON css_admin.staff_push_delivery (run_after, created_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS staff_push_delivery_lease_idx
  ON css_admin.staff_push_delivery (lease_expires_at)
  WHERE status = 'sending';

-- The separate Staff push dispatcher observes ready jobs and creates
-- idempotent delivery rows *after* exports commit. There is deliberately
-- NO trigger on export_job: notification failures cannot roll back a file
-- becoming Ready.
-- Migration may be run by the postgres maintenance role; explicitly
-- grant only the required DML to the existing CSS Admin application DB role.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON css_admin.staff_push_subscription, css_admin.staff_push_delivery
  TO css_admin;
COMMIT;
