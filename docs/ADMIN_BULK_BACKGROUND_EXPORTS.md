# Bulk CSV background exports — Staff Admin phase 2

## Scope

The seven `/bulk-import` tabs now offer **Queue background CSV**, using the
already-deployed, root-owned `css-admin-export-worker`, PostgreSQL
`css_admin.export_job`, private storage, Jobs page, owner-checked downloads
and Staff Admin notification bell.

- Company structure: `bulk-company-structure.csv`
- Users: `bulk-company-users.csv`
- Roles & permissions: `bulk-company-roles.csv`
- Role product restrictions: `bulk-role-products.csv`
- Company product restrictions: `bulk-company-products.csv`
- Company descriptions: `bulk-company-descriptions.csv`
- Purchase controls: `bulk-purchase-controls.csv`

Column layouts, wildcard `*` semantics, escaping, company ordering, duplicate
reference handling, role permission-tree consistency and legacy end-of-file
newline behavior match the existing direct CSV endpoints. The old
`/api/bulk-import/exports/*` GET routes are **retained for compatibility**,
but the normal Bulk import / export UI uses background jobs. Example CSVs and
import preview/apply flows are not changed.

## Security and operational boundaries

- Enqueue re-reads the initiating Staff Admin's Magento identity and
  `getAllCompanies()` scope, and stores **only those company IDs**. A worker's
  broader Magento visibility cannot expand a queued job. Existing per-owner
  three-active-job limit applies across XLSX and CSV.
- Private CSV is generated one company at a time, buffered to disk in ~64 KiB
  chunks, with a 256 MiB artifact limit. A single Magento GraphQL response can
  still be large — *per-company* controls APIs are not paginated today.
- Worker re-checks all queued company IDs against its current visibility,
  enforces resource compatibility for combined roles, reports progress and
  makes the artifact Ready **only after** the complete file is flushed/synced.
  Failed or lease-invalid artifacts are removed.
- Downloads require the **same** Magento Staff Admin ID as enqueue and a
  fresh check of **all approved companies** against current visibility,
  including reference requirements and structural consistency. Artifacts are
  served only from root-owned 0700 storage, through authenticated no-store
  routes, using streams (rather than loading a giant CSV into Next RAM).
- The worker only uses specifically allowlisted **GraphQL query operations**.
  No Fluid changes are required, but its Magento credential is not truly
  read-only under the current Fluid ACLs. Keep user 35 pinned and use the
  minimum existing ACL permissions; do not widen company sales-rep assignments.
- CSV export is **not** CSV import scaling. The bulk CSV preview/import
  workflow still has its own 10 MiB upload limit and row limits. Very large
  exported CSVs may need splitting before re-import. Do not silently loosen
  those limits in this release.
- Phase 1 grouped company-structure **XLSX** jobs and existing notifications
  remain supported. Seven-day artifact expiry applies to both formats.
- This is not PWA/Web Push and does not perform scheduled recurring exports.

## Deployment gate — do not deploy without migration and preflight

1. **Do not merge until tests are green.** In a separate test worktree:
   `node --test tests/admin-export-jobs.test.mjs tests/admin-bulk-export-jobs.test.mjs tests/bulk-company-descriptions.test.mjs tests/bulk-role-products-scale.test.mjs`,
   then `yarn lint`, `yarn typecheck`, `yarn build`.
2. Before restarting worker or web, back up `css_admin` PostgreSQL via the
   same secure process used for migration 002. **Manually apply**
   `deploy/postgres/003_bulk_export_jobs.sql` with `ON_ERROR_STOP=1`
   using the already-approved credential-loading method. Do not paste
   connection strings or passwords. The migration widens the allowed job-kind
   enum and the company-count CHECKs; it does not drop existing jobs or files.
3. Build the **merged main** release in `/srv/css/css_admin` using
   `yarn install --frozen-lockfile && yarn build` (after safe fast-forward and
   git clean checks). The new worker refuses to start until migration 003 is
   detected.
4. **While the old worker remains online**, run this query-only preflight from
   the new main build (it does not claim jobs):

   ```bash
   node .worker-dist/worker/export-jobs.js --preflight --check-ref=WIL055 --check-bulk
   ```

   It pins service user 35, verifies the database, Magento management and
   catalogue read scope, and additionally reads **purchase templates** and
   **company presentation descriptions** for two WIL055 companies. If this
   fails, **STOP**: no PM2 restart or UI activation. Existing Fluid ACL
   permissions may need careful review; do not deploy Fluid.
5. When green, restart only the separate worker:
   `pm2 restart css-admin-export-worker --update-env`. Confirm PM2 reports
   one worker online with no restart loop and logs
   `started; queue=postgres, files=private, concurrency=1`.
6. Only after the worker is stable, restart web:
   `pm2 restart css-admin --update-env`. Confirm
   `curl -fsS http://127.0.0.1:3067/api/health`.
7. Queue **one** bulk type from `/bulk-import`, check Jobs goes Queued →
   Running → Ready, download CSV and compare the format/row counts against
   the legacy endpoint for a controlled test sample; then test remaining
   six types and the existing grouped XLSX path. Verify bell notification,
   expiry/download auth, and that a missing ACL fails privately without a
   partial downloadable artifact.

Rollback (if activation reveals a problem): stop the new worker, restore the
previous `css-admin` build and previous worker build, then restart their PM2
processes. Migration 003 is additive; **do not drop the queue table or delete
private artifacts**. The old worker must not be left running against new bulk
jobs — it does not understand their `export_kind`. Do not enqueue new CSV jobs
until the new worker is healthy.

## Throughput

One worker handles one job at a time; bulk CSV reads one company at a time,
while original grouped XLSX collects two companies concurrently. Bulk CSV
artifacts are flushed frequently and leases are renewed after each completed
company; a single slow or oversized Magento company response remains limited
by the worker's existing GraphQL timeout and the host's memory.
