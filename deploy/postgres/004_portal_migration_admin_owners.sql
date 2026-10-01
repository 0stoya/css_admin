BEGIN;

ALTER TABLE css_admin.portal_migration
    ADD COLUMN IF NOT EXISTS owner_admin_user_id integer;

ALTER TABLE css_admin.portal_migration_task
    ADD COLUMN IF NOT EXISTS owner_admin_user_id integer;

CREATE INDEX IF NOT EXISTS portal_migration_owner_admin_idx
    ON css_admin.portal_migration (owner_admin_user_id);

COMMIT;
