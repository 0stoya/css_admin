# Company finance local snapshots

## Purpose

Company Finance is backed by a local Postgres read model. Interactive Admin pages continue to use Fluid/Magento for company identity, hierarchy and authorization, while the finance cache can now be refreshed directly from the OGL API without a Magento administrator session.

OGL remains the source of truth for order activity. Postgres stores derived snapshots only.

## Read behaviour

1. `/companies/[id]/finance` loads the Magento company record to obtain its company ID and CREF.
2. The Finance workspace looks in Postgres for the latest snapshot matching either that Magento company ID or CREF.
3. Direct OGL snapshots are stored with `company_id = NULL` and are mapped back to the Magento company by CREF when rendered.
4. If no local snapshot exists, the existing Fluid GraphQL financial-summary request remains as a compatibility fallback and its successful result is persisted.
5. Group-head Finance maps the head and every visible descendant to their latest CREF/company snapshot and calculates the aggregate locally.

This split deliberately keeps the automatic finance job independent of Magento authentication without changing the existing Admin company hierarchy.

## Direct OGL source

Fluid's existing OGL modules use these contracts:

```text
GET {OGL_API_URL}/customers/
GET {OGL_API_URL}/customer/{CREF}/orders/{days}/
Authorization: PLAIN {OGL_API_KEY}
Accept: application/json
```

The direct sync uses the same order fields Fluid currently consumes:

- `attributes.ordno`
- `attributes.orddate`
- `attributes.value`
- `attributes.cref`

It calculates:

- current-year spend/order count;
- rolling 7 days;
- rolling 30 days;
- rolling 3 months;
- rolling 6 months;
- true rolling 365 days;
- January–December current-year totals;
- last order date.

The history request is always large enough to cover both YTD and the rolling 365-day window.

## Database migrations

Apply migrations in order:

```bash
psql "$CSS_ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f deploy/postgres/001_company_finance_snapshots.sql

psql "$CSS_ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f deploy/postgres/002_direct_ogl_finance_sync.sql
```

Migration 002:

- allows automatic snapshots with nullable `company_id`;
- adds `source_kind` (`FLUID_GRAPHQL` or `OGL_DIRECT`);
- adds a CREF/latest index and CREF/source uniqueness;
- adds `css_admin.company_finance_sync_run` for operational run history.

## Environment and source switch

The finance source selector defaults to Fluid when it is missing or invalid:

```env
CSS_ADMIN_FINANCE_SYNC_SOURCE=fluid
```

With `fluid` selected:

- Finance pages ignore `OGL_DIRECT` snapshots and continue using the existing local Fluid snapshots / authenticated Fluid fallback.
- `yarn finance:sync` exits successfully with `status: "DISABLED"` and does not call OGL.
- An installed systemd timer is therefore harmless, although production should leave the direct-OGL timer disabled until Web Connector access is approved.

Direct OGL is opt-in only:

```env
CSS_ADMIN_FINANCE_SYNC_SOURCE=ogl
```

For local/manual direct-OGL testing, these values may live in the ignored `.env.local` file. The sync runner automatically loads `.env.local` when present.

```env
CSS_ADMIN_DATABASE_URL=postgresql://css_admin:REPLACE_ME@127.0.0.1:5432/css_admin
CSS_ADMIN_FINANCE_SYNC_SOURCE=ogl
CSS_ADMIN_OGL_API_URL=https://ogl-api.example.com
CSS_ADMIN_OGL_API_KEY=REPLACE_WITH_OGL_API_KEY
CSS_ADMIN_FINANCE_CURRENCY=GBP
CSS_ADMIN_FINANCE_SYNC_CONCURRENCY=5
CSS_ADMIN_FINANCE_SYNC_TIMEOUT_MS=25000
```

Do not expose any of these through `NEXT_PUBLIC_*`.

On the live server, use the dedicated root-only systemd environment file rather than coupling the timer to Next.js:

```bash
sudo install -m 600 -o root -g root /dev/null /etc/css-admin-finance-sync.env
sudoedit /etc/css-admin-finance-sync.env
```

Example content while direct OGL remains disabled:

```env
CSS_ADMIN_DATABASE_URL=postgresql://css_admin:REPLACE_ME@127.0.0.1:5432/css_admin
CSS_ADMIN_FINANCE_SYNC_SOURCE=fluid
```

When direct Web Connector access is eventually approved, switch the source to `ogl` and add the OGL URL/key plus the optional tuning values.

## Manual acceptance

Direct OGL acceptance is only applicable when `CSS_ADMIN_FINANCE_SYNC_SOURCE=ogl`.

Before enabling the timer, test one CREF:

```bash
yarn finance:sync --cref BIO007 --dry-run
```

The dry run calls OGL and calculates all periods but does not write Postgres.

Then persist one CREF:

```bash
yarn finance:sync --cref BIO007
```

Or exercise a small sample:

```bash
yarn finance:sync --limit 5 --dry-run
yarn finance:sync --limit 5
```

Full manual sync:

```bash
yarn finance:sync
```

A fully successful run exits 0. A partial run (some customers failed) exits 2 and is treated as a successful systemd invocation while still being recorded as `PARTIAL` in Postgres. A total failure exits 1.

Inspect the latest run:

```bash
psql "$CSS_ADMIN_DATABASE_URL" -x -c "
SELECT *
FROM css_admin.company_finance_sync_run
ORDER BY started_at DESC
LIMIT 5;
"
```

Inspect latest direct snapshots:

```bash
psql "$CSS_ADMIN_DATABASE_URL" -c "
SELECT DISTINCT ON (cref)
  cref,
  source_kind,
  year_to_date_value,
  last_7_days_value,
  last_30_days_value,
  last_6_months_value,
  last_365_days_value,
  source_refreshed_at
FROM css_admin.company_order_finance_snapshot
WHERE cref IS NOT NULL
ORDER BY cref, source_refreshed_at DESC;
"
```

## Automatic systemd sync

Do not enable the direct-OGL timer in production while `CSS_ADMIN_FINANCE_SYNC_SOURCE=fluid`. The runner itself is fail-safe and exits as disabled without making an OGL request, but leaving the timer off makes the operational intent explicit.

When direct OGL is intentionally enabled, install the units shipped in this repository:

```bash
sudo cp deploy/systemd/css-admin-finance-sync.service /etc/systemd/system/
sudo cp deploy/systemd/css-admin-finance-sync.timer /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable --now css-admin-finance-sync.timer
```

The timer runs at 00:00, 04:00, 08:00, 12:00, 16:00 and 20:00, with up to five minutes of randomized delay. `Persistent=true` causes a missed calendar run to be caught up after the server returns.

Check it with:

```bash
systemctl status css-admin-finance-sync.timer --no-pager
systemctl list-timers css-admin-finance-sync.timer --all
journalctl -u css-admin-finance-sync.service -n 100 --no-pager
```

You can trigger the exact service manually at any time:

```bash
sudo systemctl start css-admin-finance-sync.service
sudo systemctl status css-admin-finance-sync.service --no-pager
```

## Finance visibility

`css_admin.company_finance_visibility` remains company-ID keyed because it is a css_admin presentation preference, not OGL source data.

The switches control which summary cards are shown. On a group head they also control which period columns appear in the group table. Hiding a period never deletes its snapshot value.

## Compatibility fallback

The existing Fluid GraphQL finance path remains deliberately available:

- it seeds an unseeded company when direct OGL sync is not configured;
- manual **Refresh finance** and **Refresh group finance** still use the authenticated Fluid path in this slice;
- those rows are marked `FLUID_GRAPHQL`;
- direct automatic rows are marked `OGL_DIRECT`;
- while `CSS_ADMIN_FINANCE_SYNC_SOURCE=fluid`, `OGL_DIRECT` rows are ignored completely;
- when `CSS_ADMIN_FINANCE_SYNC_SOURCE=ogl`, a direct snapshot newer than 12 hours is preferred;
- if direct sync is enabled but stale for more than 12 hours, a newer Fluid snapshot may take over until the timer recovers.

Direct OGL snapshots provide the true rolling 365-day value. The legacy Fluid fallback may leave 365 days blank until its GraphQL contract adds that exact period.
