BEGIN;

ALTER TABLE css_admin.portal_migration
    ADD COLUMN IF NOT EXISTS owner_admin_user_id integer,
    ADD COLUMN IF NOT EXISTS created_by_admin_user_id integer,
    ADD COLUMN IF NOT EXISTS created_by_username text,
    ADD COLUMN IF NOT EXISTS created_by_name text;

ALTER TABLE css_admin.portal_migration_task
    ADD COLUMN IF NOT EXISTS owner_admin_user_id integer;

ALTER TABLE css_admin.portal_migration_event
    ADD COLUMN IF NOT EXISTS actor_admin_user_id integer,
    ADD COLUMN IF NOT EXISTS actor_username text;

CREATE INDEX IF NOT EXISTS portal_migration_owner_admin_idx
    ON css_admin.portal_migration (owner_admin_user_id);

CREATE INDEX IF NOT EXISTS portal_migration_created_by_admin_idx
    ON css_admin.portal_migration (created_by_admin_user_id);

COMMIT;
