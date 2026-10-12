# Staff Admin navigation — CRM and Settings

## Information architecture

The Staff Admin primary navigation now presents:

| Top-level | Existing or new destination | Purpose |
| --- | --- | --- |
| Companies | `/companies` (unchanged) | Company and employee administration |
| Export jobs | `/jobs` (unchanged) | Queue progress and owner-checked downloads |
| Bulk import | `/bulk-import` (unchanged) | Existing company and catalogue import/export |
| OGL | `/ogl` (unchanged) | OGL company registry, rep mappings and profiles |
| CRM | `/crm` (new) | Landing for Portal migration and help resources |
| Settings | `/settings` (new) | Personal Staff PWA installation and device alerts |

**CRM** has an expanding submenu containing Overview (`/crm`),
Migrations (`/migrations`) and Help & guides (`/help`). These existing
routes have **not been moved or redirected**. Existing deep links into
`/migrations/[id]` still work, with CRM expanded and Migrations selected.

**Settings** presents two cards:

- **Export notifications** — reuses the existing authenticated Staff
  `StaffExportPushControls` component and the exact same opt-in/out API
  endpoints. This is a *per-device*, per-Staff-account preference.
- **Install CSS Admin** — reuses `PwaInstallControl` and the existing
  Staff PWA manifest/service worker. PWA installation remains optional.

The global Jobs bell stays in the Staff header. Export Jobs retains job
progress, download actions and its existing notification acknowledgements;
it no longer shows device-registration controls. The Company Portal's
installation affordance remains in its own header. Company-specific
`/companies/[id]/settings` is unchanged and separate from global
`/settings`.

## Responsive and routing behaviour

CRM remains highlighted in the sidebar *and* compact/mobile primary
navigation when the current route is a Migration detail or Help page.
Only CRM sublinks opt into descendants; query-based OGL/Bulk Import views
retain their original exact-view selection to avoid multiple active tabs.

## Safety

This is an **Admin UI-only** change. It adds no Magento/Fluid changes,
GraphQL mutations, database migrations, push credentials, new subscription
endpoints, export-worker processes or permissions. All new routes are under
the existing authenticated Staff Admin layout; the current server-side
identity binding and download authorization remain intact.

## Verification and rollout

From an isolated worktree:

```bash
node --test tests/admin-settings-crm-navigation.test.mjs tests/admin-staff-push.test.mjs tests/admin-accessibility-phase7.test.mjs tests/admin-pwa-foundation.test.mjs
yarn lint
yarn typecheck
yarn build
```

After passing checks and merging to main, deploy only `css-admin`.
No database migration or worker restart is needed. Verify `/api/health`,
Staff `/settings` and `/crm`, a live `/migrations/[id]` deep link,
`/help`, OGL and Bulk Import query tabs, and the existing Jobs bell.
Existing enrolled devices must still receive export-ready push notifications.
