# CSS Admin background export jobs — Phase 1

## Purpose

Queue a product-only company-structure workbook from Staff Admin while continuing
other work. A separate Node.js worker persists progress in PostgreSQL and writes
a private XLSX. The Jobs screen and header bell announce when the workbook is
ready. The initiating browser and session can be closed during generation.

This is **not** a PWA or Web Push implementation; those are Phase 2.
Recurring scheduled exports and streaming beyond the existing XLSX limits
are future work. Phase 1 queues exports **now**.

## Privacy and authorization

- Enqueue is a Next Server Action (same-origin/CSRF protected by Next) and
  re-reads the initiating user's live Fluid Admin identity and company scope.
- The job stores a numeric Magento Admin user ID, authorized company IDs,
  group-head ID, progress, timestamps and file metadata. **No browser token
  or Magento password is ever stored in a job row.**
- The worker logs into Magento using a **dedicated Magento Admin service
  account** from its own protected env file. This is NOT an integration token:
  Fluid's AdminCompanyScope requires USER_TYPE_ADMIN. The service account has
  management-capable ACL grants (described below); the worker issues only
  explicitly allowlisted GraphQL **query** operations. **That code-level
  allowlist cannot restrict someone who steals the Magento credential.**
- Worker startup pins the service account to CSS_ADMIN_JOB_EXPECTED_ADMIN_ID
  to catch accidental credential substitution.
- The worker uses only the company IDs authorized when queued. It verifies
  these companies still form the same canonical group, and never adds
  companies just because the service account sees more.
- Downloads require the **same currently authenticated Admin user** and
  recheck that user's live Fluid scope for **all originally approved companies**.
  Permission revocation denies download; no blind artifact URLs.
- Files are private, never served from public/, never cached by Next or a PWA,
  and only downloadable via the owner-checked endpoint.
- Exports are strictly read-only. Category restrictions are intentionally
  absent (same product-only format as PR #132).

## Prerequisites

- Working local PostgreSQL connection for css_admin.
- A dedicated Magento Admin account (not an integration token or real staff
  member's login), with the *minimum available* Fluid ACL grants and limited
  access to the business scope needed by the worker.
- **IMPORTANT — current Fluid ACL limitation:** the GraphQL **read** operations
  also require **write-capable** resources:
  - Company listing: `Fluidcommerce_HyvaCompany::index`
  - Current Staff identity and company management: `Fluidcommerce_HyvaCompany::manage`
  - Company controls export additionally needs
    `Fluidcommerce_HyvaCompanyCatalogRestriction::company_restriction` and
    `Fluid_UserRoleRestrictions::manage`
  - Access to companies outside the service user's sales-rep assignment needs
    `Css_Commerce::all_companies` (potentially very broad).
  The worker issues **queries only**, but its credential is **not actually
  read-only** under these ACLs. This Phase 1 implementation deliberately
  **requires no Fluid repository or deployment changes**. Treat the account
  as privileged: do not assign it a Magento Super Admin role; grant only the
  listed existing ACL resources and their necessary ancestors. In particular,
  grant Css_Commerce::all_companies only if the intended company group spans
  different sales representatives. Do not reassign any companies to the
  service account to bypass that limitation. Audit and rotate its credential.
  A future Fluid read-only ACL split would be an optional hardening project,
  not a deployment dependency for this feature.
- A dedicated absolute directory such as /var/lib/css-admin/export-jobs (0700).
- Admin Next process and export worker must use the **same** database and
  CSS_ADMIN_EXPORT_DIR path; only the worker needs Magento service credentials.
- Restricted runtime secret file, e.g. /etc/css-admin/export-worker.env (0600),
  outside the git repo, containing:

      CSS_ADMIN_DATABASE_URL=postgres://...
      CSS_ADMIN_EXPORT_DIR=/var/lib/css-admin/export-jobs
      MAGENTO_BASE_URL=https://your-magento-origin
      MAGENTO_STORE_CODE=default
      CSS_ADMIN_JOB_MAGENTO_USERNAME=dedicated_export_admin
      CSS_ADMIN_JOB_MAGENTO_PASSWORD=...
      # Set after the first --preflight reveals the numeric Magento Admin ID:
      CSS_ADMIN_JOB_EXPECTED_ADMIN_ID=123
      # MAGENTO_GRAPHQL_URL=...              # optional custom endpoint
      # MAGENTO_ADMIN_TOKEN_URL=...          # optional custom endpoint

Do not put the worker username/password in Next's .env.production or expose
them via NEXT_PUBLIC_ variables. Rotate service credentials independently.
Both the worker's Magento GraphQL URL and Admin-token URL must use HTTPS:
the worker rejects plain HTTP so its privileged credentials cannot be sent
over unencrypted connections.

## Release gate — no Fluid deployment required

PostgreSQL schema installation does **not** enable exports. We use the
already-deployed Fluid GraphQL contracts and a dedicated Magento Admin
service account with the minimum **existing** ACL resources listed above.
This avoids changing Fluid for this release, but explicitly accepts a
privileged service credential as an interim trade-off.

Use the worker's read-only preflight **before enabling PM2**:

    cd /srv/css/css_admin-pr133
    yarn build:worker
    node .worker-dist/worker/export-jobs.js --preflight --check-ref=WIL055

The preflight checks database schema, Admin identity, company-list visibility,
and the management + controls GraphQL permissions on the group head and one
child. It does not claim, insert or update jobs; it also never prints tokens,
passwords or user records. The first run prints only the service Admin user_id;
set CSS_ADMIN_JOB_EXPECTED_ADMIN_ID to that value, then rerun the preflight.

If WIL055 is not visible, or the group has children assigned to other sales
representatives, do **not** alter sales representative assignments. Review
whether this dedicated account requires the existing
Css_Commerce::all_companies ACL. Treat that grant as particularly sensitive.
Do not start the worker while the preflight is failing.

The preflight checks two sample companies, not every member. The worker still
checks every approved company when processing a real job and fails without
publishing a partial workbook if a permission error occurs.

## Safe deployment order (root PM2)

1. Fetch main and run yarn install --frozen-lockfile, then yarn build. This
   builds both the Next application and the separate CommonJS worker into
   .worker-dist. Review the TypeScript/build output before continuing.
2. **Back up PostgreSQL** and apply the explicit migration manually:

       psql "$CSS_ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 \
         -f deploy/postgres/002_admin_export_jobs.sql

   Make sure CSS_ADMIN_DATABASE_URL is securely loaded in the shell before
   running psql. Never paste credentials or the connection string into chat.
3. Create the export directory with 0700 permissions and the dedicated worker
   env file with 0600 permissions, owned by the worker runtime user (root in
   the current deployment). Ensure the service credential works with Fluid.
4. Run the worker preflight from the test worktree. Confirm service identity
   matches CSS_ADMIN_JOB_EXPECTED_ADMIN_ID, and that the selected group is
   readable with the existing Fluid ACL. No Fluid changes are needed.
5. Set these in css_admin's runtime .env.production (no Magento job password):

       CSS_ADMIN_EXPORT_JOBS_ENABLED=1
       CSS_ADMIN_EXPORT_DIR=/var/lib/css-admin/export-jobs

   CSS_ADMIN_DATABASE_URL is already used for local Finance and must reference
   the same database as the worker.
6. Restart the web process after the build:

       pm2 restart css-admin --update-env

7. Start the **second** PM2 process separately (do NOT add it to the existing
   css-admin web ecosystem until the migration/credentials are ready):

       pm2 start ecosystem.exports.config.cjs --only css-admin-export-worker
       pm2 status
       pm2 logs css-admin-export-worker --lines 40 --nostream

**Rollback:** stop only css-admin-export-worker, set
CSS_ADMIN_EXPORT_JOBS_ENABLED=0 and restart css-admin. Direct XLSX downloads
remain available. Do not drop the table or delete private files during rollback.

## Operation

Company Overview and Import / export show **Queue background export** alongside
**Download now**. A valid queue request opens Jobs with status Queued. A worker
claims a job, updates a company count, writes a ready file and stores an
expiry timestamp. The header bell polls every 30 seconds while visible.
Jobs auto-refresh while work is pending, offer queued-job cancellation and
allow marking ready notifications read.

One worker handles one job at a time, fetching two companies concurrently.
Up to three jobs may be queued or running per Admin. Workers claim jobs with
FOR UPDATE SKIP LOCKED, a per-attempt lease token and a 3-minute lease,
and can recover an interrupted export. Network errors retry up to three
attempts. Failed/expired jobs never expose partial workbooks.

Ready files expire after 7 days. No browser push, browser background work,
external scheduler, customer Portal or Magento schema changes.

The current generator still limits a workbook to 80 companies and 250,000
total worksheet rows, and the worker caps output at 75 MB. For genuinely
larger exports, add a streaming XLSX phase rather than removing the limits.

## Validation

    node --test tests/admin-export-jobs.test.mjs \
      tests/company-structure-snapshot.test.mjs \
      tests/admin-header-company-switcher.test.mjs
    yarn typecheck
    yarn lint
    yarn build

Live acceptance with a dedicated test group:
1. Queue an export, leave the Admin page, return to Jobs; it remains queued/
   running until the worker finishes and progress advances.
2. Confirm the bell displays the ready count and Download Excel opens the
   same product-only workbook as the direct export, with all company sheets.
3. Verify another Admin cannot list/download the job.
4. Remove the initiating Admin's company access and confirm their old job
   file cannot be downloaded.
5. Queue then cancel a job before it starts; worker must never execute it.
6. Restart the worker during a job, wait for lease expiry and confirm recovery.
7. Confirm expired files are deleted while job history remains visible.
8. Test worker missing credentials and database outage: fail safely, preserve
   queued data, log no passwords/tokens.
9. Keep PWA/Web Push deliberately out of Phase 1.
