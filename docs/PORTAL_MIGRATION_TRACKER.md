# Portal migration tracker

The Admin application includes a staff-only migration workspace for moving OGL / Tower portals into CSS Commerce.

## Routes

- `/migrations` — programme queue, filters, progress and new migration form
- `/migrations/[id]` — one portal hierarchy, checklist, blockers, owner, stage and activity history
- `/help` — searchable Admin / portal migration how-to articles

These routes live under `app/(admin)` and therefore inherit the existing Admin token boundary. Migration server actions also check `getAdminToken()` before writing. Nothing is added to the customer `(portal)` route group or Portal navigation.

## Storage

The tracker uses the existing local Admin Postgres connection:

```bash
CSS_ADMIN_DATABASE_URL=postgres://...
```

Apply the tracker schemas in order:

```bash
psql "$CSS_ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f deploy/postgres/003_portal_migrations.sql

psql "$CSS_ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f deploy/postgres/004_portal_migration_admin_owners.sql
```

The migration creates:

- `css_admin.portal_migration`
- `css_admin.portal_migration_task`
- `css_admin.portal_migration_event`

One root OGL company reference can have only one migration record.

## Ownership

Migration and checklist ownership use the active Magento Admin directory already returned by Fluid's `css_admin_company_options.sales_representatives` contract.

- Owner is selected from active Magento Admin users rather than typed as free text.
- The selected Magento Admin user ID and a display-name snapshot are stored locally.
- Submitted owner IDs are resolved again server-side against the current active Admin list before saving.
- An inactive or removed historical owner remains readable on existing migration records but cannot be newly assigned.
- Creator/current-user attribution is intentionally deferred until the backend can expose the authenticated Magento Admin identity.

## Standard checklist

A new migration automatically receives:

1. Company hierarchy
2. Company products
3. Roles & permissions
4. Company users
5. Role product restrictions
6. Purchase controls
7. Company descriptions
8. Personalisation
9. Import preview checked
10. Import applied
11. Internal QA
12. Customer review
13. Go-live

The import-related items link back to the relevant existing Admin bulk-import view.

Task states are:

- Not started
- In progress
- Blocked
- Complete
- Not applicable

Complete and Not applicable count as resolved. A migration is checklist-ready only when every task is resolved and none is blocked.

## Programme stages

Stages are deliberately separate from checklist progress:

- New
- Discovery
- Data preparation
- Ready to import
- Imported
- Internal QA
- Customer review
- Ready to live
- Live
- Paused

This prevents a manually advanced stage from hiding unfinished checklist work.

## Initial operating model

Keep the first release intentionally small:

- one migration record per portal hierarchy
- Magento Admin owner assignment
- target go-live date
- Magento Admin checklist-item owner, status and note/blocker
- append-only activity entries for tracker changes
- searchable working guidance

Do not turn this into a general ticketing system. The Admin app remains the place where migration work is performed; the tracker records whether that work is ready, blocked or complete.
