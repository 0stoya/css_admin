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

-- Store a durable recipient snapshot in the same transaction that commits
-- export_job.status='ready'. Push delivery itself is asynchronous and never
-- happens from the export worker or the web request.
CREATE OR REPLACE FUNCTION css_admin.enqueue_staff_export_ready_push()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO css_admin.staff_push_delivery (job_id, subscription_id)
  SELECT NEW.id, subscription.id
  FROM css_admin.staff_push_subscription subscription
  WHERE subscription.owner_admin_user_id = NEW.owner_admin_user_id
    AND subscription.expires_at > now()
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS staff_export_ready_push ON css_admin.export_job;
CREATE TRIGGER staff_export_ready_push
AFTER UPDATE OF status ON css_admin.export_job
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'ready')
EXECUTE FUNCTION css_admin.enqueue_staff_export_ready_push();

COMMIT;
