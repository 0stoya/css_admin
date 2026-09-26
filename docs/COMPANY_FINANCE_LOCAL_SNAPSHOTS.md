# Company finance local snapshots

## Purpose

The Admin Finance workspace currently receives OGL order activity through the Fluid / Magento GraphQL contract. This change adds a local Postgres read model so opening a company does not need a fresh OGL-backed GraphQL aggregation every time.

The local database is a cache/read model only. OGL/Fluid remains the source of truth for order activity.

## Runtime behaviour

1. `/companies/[id]/finance` looks for the latest local snapshot.
2. If a local snapshot exists, it is served immediately.
3. If no local snapshot exists, the existing Fluid GraphQL query is used and the successful result is persisted.
4. **Refresh finance** always asks Fluid for a fresh source result and stores it.
5. A visible group head gets a read-only table for the head plus all descendants using their latest stored snapshots.
6. **Refresh group finance** refreshes the visible structure in batches of five.

If Postgres is not configured, the existing live GraphQL behaviour remains available. If Postgres is configured but the migration has not been applied, the Finance page falls back to live data and reports the local persistence problem instead of taking the company record offline.

## Tables

`css_admin.company_order_finance_snapshot`

- append/history model keyed by `(company_id, source_refreshed_at)`;
- stores YTD, 7-day, 30-day, 3-month, 6-month and optional 365-day periods;
- keeps the January-December payload used by the existing chart;
- records both the source refresh time and local capture time.

`css_admin.company_finance_visibility`

- company-local presentation settings;
- controls which Finance summary cards are shown;
- on a group head, the same switches control the columns in the group snapshot table;
- hiding a period never removes its stored source data.

## Rolling 365 days

The current production GraphQL contract does not yet guarantee a `last_365_days` field. The client now probes for that field once per server process and automatically falls back to the legacy query when Fluid reports that the field does not exist.

The database field is therefore nullable. Until Fluid adds the rolling field, the UI shows `—` rather than substituting year-to-date or another non-equivalent number.

Expected future GraphQL addition:

```graphql
last_365_days {
  order_count
  value
}
```

No further database migration is required when that field becomes available.

## Live-server deployment

Apply the migration explicitly before enabling the connection string:

```bash
cd /path/to/css_admin
psql "$CSS_ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f deploy/postgres/001_company_finance_snapshots.sql
```

Example server-only environment:

```bash
CSS_ADMIN_DATABASE_URL=postgresql://css_admin:REPLACE_ME@127.0.0.1:5432/css_admin
CSS_ADMIN_DATABASE_POOL_SIZE=5
```

Do not expose either value through `NEXT_PUBLIC_*`.

Then install/build/restart using the normal deployment process:

```bash
yarn install --frozen-lockfile
yarn typecheck
yarn build
```

After deployment, open a group head Finance page and use **Refresh group finance** to seed that structure.

### Scheduled refresh boundary

The current Admin GraphQL client authenticates with the signed-in administrator's HttpOnly session cookie. This PR deliberately does **not** copy that user token into cron/systemd or persist it as a background credential.

For very large estates, the next operational slice should provision a dedicated Fluid/Magento service credential and run an all-company refresh from systemd/cron. The Postgres read model in this PR is already shaped for that job, so adding the timer later does not require another finance-table redesign.

## Group-head semantics

The group table includes the group head and every visible descendant. The `All companies` row is only labelled that way when all visible companies have a stored snapshot; otherwise it is labelled `All synced companies` so a partial cache is never presented as a complete group total.

Child-company visibility switches do not remove data from the group-head calculation. The group head's own visibility profile decides which period columns are displayed on its Finance workspace.
