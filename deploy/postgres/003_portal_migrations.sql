BEGIN;

CREATE SCHEMA IF NOT EXISTS css_admin;

CREATE TABLE IF NOT EXISTS css_admin.portal_migration (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text NOT NULL,
    root_company_ref text NOT NULL,
    owner_name text,
    stage text NOT NULL DEFAULT 'new',
    target_date date,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT portal_migration_stage_check CHECK (
      stage IN (
        'new',
        'discovery',
        'data_prep',
        'ready_to_import',
        'imported',
        'qa',
        'customer_review',
        'ready_to_live',
        'live',
        'paused'
      )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS portal_migration_root_company_ref_unique
    ON css_admin.portal_migration (UPPER(root_company_ref));

CREATE INDEX IF NOT EXISTS portal_migration_stage_target_idx
    ON css_admin.portal_migration (stage, target_date, updated_at DESC);

CREATE TABLE IF NOT EXISTS css_admin.portal_migration_task (
    migration_id bigint NOT NULL
      REFERENCES css_admin.portal_migration(id)
      ON DELETE CASCADE,
    task_key text NOT NULL,
    label text NOT NULL,
    description text NOT NULL,
    tool_href text,
    sort_order integer NOT NULL,
    status text NOT NULL DEFAULT 'not_started',
    owner_name text,
    note text,
    completed_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (migration_id, task_key),

    CONSTRAINT portal_migration_task_status_check CHECK (
      status IN (
        'not_started',
        'in_progress',
        'blocked',
        'complete',
        'not_applicable'
      )
    )
);

CREATE INDEX IF NOT EXISTS portal_migration_task_status_idx
    ON css_admin.portal_migration_task (migration_id, status, sort_order);

CREATE TABLE IF NOT EXISTS css_admin.portal_migration_event (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    migration_id bigint NOT NULL
      REFERENCES css_admin.portal_migration(id)
      ON DELETE CASCADE,
    event_type text NOT NULL,
    message text NOT NULL,
    actor_name text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portal_migration_event_recent_idx
    ON css_admin.portal_migration_event (migration_id, created_at DESC, id DESC);

COMMIT;
