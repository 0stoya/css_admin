BEGIN;

CREATE SCHEMA IF NOT EXISTS css_admin;

CREATE TABLE IF NOT EXISTS css_admin.company_order_finance_snapshot (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id integer NOT NULL,
    cref text,
    currency varchar(3) NOT NULL,
    financial_year integer NOT NULL,

    year_to_date_order_count integer NOT NULL DEFAULT 0,
    year_to_date_value numeric(16, 2) NOT NULL DEFAULT 0,

    last_7_days_order_count integer NOT NULL DEFAULT 0,
    last_7_days_value numeric(16, 2) NOT NULL DEFAULT 0,

    last_30_days_order_count integer NOT NULL DEFAULT 0,
    last_30_days_value numeric(16, 2) NOT NULL DEFAULT 0,

    last_3_months_order_count integer NOT NULL DEFAULT 0,
    last_3_months_value numeric(16, 2) NOT NULL DEFAULT 0,

    last_6_months_order_count integer NOT NULL DEFAULT 0,
    last_6_months_value numeric(16, 2) NOT NULL DEFAULT 0,

    -- Nullable until Fluid exposes the rolling 365-day source field.
    last_365_days_order_count integer,
    last_365_days_value numeric(16, 2),

    monthly jsonb NOT NULL DEFAULT '[]'::jsonb,
    last_order_date timestamptz,
    source_refreshed_at timestamptz NOT NULL,
    captured_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT company_order_finance_snapshot_monthly_array
      CHECK (jsonb_typeof(monthly) = 'array'),
    CONSTRAINT company_order_finance_snapshot_source_unique
      UNIQUE (company_id, source_refreshed_at)
);

CREATE INDEX IF NOT EXISTS company_order_finance_snapshot_latest_idx
    ON css_admin.company_order_finance_snapshot
    (company_id, source_refreshed_at DESC, captured_at DESC);

CREATE TABLE IF NOT EXISTS css_admin.company_finance_visibility (
    company_id integer PRIMARY KEY,
    show_year_to_date boolean NOT NULL DEFAULT true,
    show_last_7_days boolean NOT NULL DEFAULT true,
    show_last_30_days boolean NOT NULL DEFAULT true,
    show_last_3_months boolean NOT NULL DEFAULT true,
    show_last_6_months boolean NOT NULL DEFAULT true,
    show_last_365_days boolean NOT NULL DEFAULT true,
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
