# Staff export-ready Web Push — PR #137 (opt-in, no Fluid changes)

## Purpose

The existing PWA and persistent export queue can notify the authenticated
**Staff Admin who requested an export**, even when their browser is closed.
The existing Jobs bell remains the universal in-app fallback. No Company Portal
or Store customer subscriptions are registered by this phase.

The original export queue already stores `owner_admin_user_id` from the Staff
Magento identity (via `css_admin_current_user`). It never uses the dedicated
Magento export worker service account (#35) as the notification recipient.

## Per-user and per-device security

- Registration requires the current Magento **Staff Admin session** and
  resolves user_id server-side. The browser does **not** supply an Admin ID.
- Each browser receives a private, opaque, HttpOnly, SameSite=Lax device cookie.
  A recipient may explicitly register up to five devices, each associated with
  a Staff owner ID and encrypted browser PushSubscription.
- Push endpoint + `p256dh` + `auth` are sealed with AES-256-GCM at rest using
  a 32-byte key outside Git. The authenticated owner/device pair is part of
  the authentication data; ciphertext cannot be swapped between users.
- Known HTTPS-only push provider hosts are allowlisted (Google FCM, Mozilla
  Push, Apple Web Push). No arbitrary URLs, local IP addresses, redirects
  or unencrypted endpoints are sent requests by the dispatcher.
- Browser permission is requested only when the user clicks
  **Enable device alerts** under Staff Settings. A separately connected device can be
  revoked from its own Settings page. Logging out, changing Staff identity,
  switching to Company Portal or expiring a session attempts to revoke **that
  browser's** subscription without disconnecting another phone or computer.
- Subscriptions expire after 90 days if not renewed. Never record endpoints,
  VAPID private keys, encryption secrets, customer records or push payloads in
  logs. Provider response bodies are not logged.
- A push carries only `{"event":"export_ready"}`. The notification displays
  generic text and opens **/jobs**, where the usual Staff owner and current
  company-scope authorization are rechecked before any XLSX/CSV download.
- Portal and Store customer identities are **not** Staff IDs. Company approval
  alerts need a separately approved Store/Fluid event source and Store's
  per-order `actions.can_approve` contract before they can be safely sent.

## Fault isolation: post-commit notification outbox

Migration `deploy/postgres/004_staff_export_push.sql` adds only
`css_admin.staff_push_subscription` and `css_admin.staff_push_delivery`
plus indexes and minimum app-role DML grants. **There is deliberately no
trigger on `export_job`**. This matters: a push database error cannot roll back
an otherwise successful export-ready state.

A new independently supervised `css-admin-staff-push` dispatcher:

1. Periodically discovers existing **ready** exports, joining subscription
   owners to `export_job.owner_admin_user_id`. It only considers devices
   whose *most recent registration time* precedes job completion, so enabling
   notifications does not send a wave of older exports.
2. Inserts per-job/per-device delivery rows with a unique key and
   `ON CONFLICT DO NOTHING` (durably deduplicated).
3. Claims one due delivery with `FOR UPDATE SKIP LOCKED`, a two-minute lease,
   and a maximum five attempts. It independently checks job/subscription owner
   equality and Ready/not-expired status before sending.
4. Uses standards-based VAPID ES256 JWT plus RFC8291 AES128GCM Web Push.
   Temporary network, HTTP 429 and 5xx failures retry with bounded backoff.
   404/410 permanently revoke invalid provider subscriptions.
5. Keeps sent/failed state for a bounded interval and prunes old entries.

A dead dispatcher, invalid VAPID keys or unreachable push service **cannot**
mark a successful export failed. Existing XLSX, CSV, Store and Kiosk are
unmodified. Push delivery is best effort (push providers/browser OS can defer
it); the Jobs page and bell always remain authoritative.

## Configuration and rollout — NEVER deploy without preflight

**PR #137 adds a new PostgreSQL migration and new PM2 process. Neither is
enabled until all checks are green.** No Fluid deployment is required.

1. Test from isolated worktree:

   ```bash
   node --test tests/admin-pwa-foundation.test.mjs tests/admin-staff-push.test.mjs tests/admin-export-jobs.test.mjs
   yarn lint
   yarn typecheck
   yarn build
   ```

   Also run a loopback-only runtime smoke test of `/api/health`,
   `/sw.js`, `/pwa/admin.webmanifest` and protected route behavior.
   A real iOS/Android browser is necessary to confirm OS-level delivery.
2. After merge, **back up** the `css_admin` PostgreSQL database via the
   established procedure, then apply `deploy/postgres/004_staff_export_push.sql`
   with `ON_ERROR_STOP=1`. Run the read-only
   `node scripts/verify-staff-push-schema.mjs` from the production Admin cwd
   after ensuring it reads the existing app DB credentials. Expected:
   `STAFF PUSH SCHEMA PASS`.
3. Generate a fresh, independent VAPID P-256 public/private keypair, plus a
   separate random 32-byte AES encryption key, **on the server**. Keep the
   private VAPID key and matching AES key in
   `/etc/css-admin/staff-push-worker.env` (0600, root-owned, no Git).
   The worker file must contain:

   ```text
   CSS_ADMIN_DATABASE_URL=<existing local css_admin connection>
   CSS_ADMIN_PUSH_ENCRYPTION_KEY=<32-byte base64url secret>
   CSS_ADMIN_PUSH_VAPID_PUBLIC_KEY=<65-byte base64url P-256 public key>
   CSS_ADMIN_PUSH_VAPID_PRIVATE_KEY=<32-byte base64url P-256 private key>
   CSS_ADMIN_PUSH_SUBJECT=mailto:<operator-controlled contact email>
   ```

   The web process's existing protected `.env.local` requires only:

   ```text
   CSS_ADMIN_PUSH_ENABLED=0
   CSS_ADMIN_PUSH_PUBLIC_ORIGIN=https://your-actual-admin-host.example
   CSS_ADMIN_PUSH_ENCRYPTION_KEY=<same 32-byte secret, never NEXT_PUBLIC>
   CSS_ADMIN_PUSH_VAPID_PUBLIC_KEY=<same public key, never NEXT_PUBLIC needed>
   ```

   The public origin must match the browser HTTPS `Origin` exactly (scheme,
   hostname and port, without a trailing slash). It is explicit because Next.js
   may see an internal HTTP URL behind Nginx. CSRF checks reject registration
   if this setting is absent or malformed.

   **Never put `CSS_ADMIN_PUSH_VAPID_PRIVATE_KEY` in the web process or any
   `NEXT_PUBLIC_*` variable**. Do not print or paste any secrets, push URLs
   or private keys into chat or logs. The dispatcher has no Magento
   credentials. Use a monitored operational email address as the VAPID subject.
4. On merged main, `yarn install --frozen-lockfile && yarn build` must produce
   `.worker-dist/worker/staff-push-dispatcher.js`. With the protected worker
   config present, run:
   ```bash
   node .worker-dist/worker/staff-push-dispatcher.js --preflight
   ```
   This checks schema and keys, **does not claim or send** anything, and prints
   no secrets. Stop on failure.
5. Start the new standalone PM2 process *after* successful preflight:
   ```bash
   pm2 start ecosystem.push.config.cjs --only css-admin-staff-push
   pm2 status
   pm2 logs css-admin-staff-push --lines 30 --nostream
   ```
   Confirm only one stable dispatcher. **Do not restart the existing export
   worker**: job completion and push are decoupled.
6. Only once dispatcher is stable, set
   `CSS_ADMIN_PUSH_ENABLED=1` in Admin's existing protected `.env.local`,
   rebuild if necessary and restart **only css-admin**.
   Verify `/api/health`, in-app Jobs bell, subscription status endpoint and
   Admin/Portal normal sign-in. No private key should be in Next env.
7. From an installed Staff PWA or supported secure Chrome/Edge browser, open
   Settings and click **Enable device alerts**. Verify it reports the current
   device enabled, then queue a small XLSX or CSV export. The notification
   should arrive after Ready even after leaving the app. Tapping opens Jobs;
   downloads still require authentication. Check opt-out, logout and
   account-switch behavior. Test from a second Staff identity and confirm
   the first user's export does **not** notify the second user.

**Rollback:** disable `CSS_ADMIN_PUSH_ENABLED=0`, restart only Admin, stop
`css-admin-staff-push`. Do not roll back export worker or delete existing
export jobs/files. Migration 004 is additive and may remain. Staff's in-app
bell continues working.

## Customer approval alerts — separate phase

Order approval actions currently live in `0stoya/css_store` under
`/account/credit-orders?scope=APPROVAL`. The Store's customer-scoped
`css_credit_orders(scope: APPROVAL)` response includes `actions.can_approve`
and `actions.can_reject`. Company Admin membership by itself is **not**
sufficient to choose recipients. A reliable customer-identity-specific order
event/recipient contract must be established before cross-origin Store/Portal
push. PR #137 creates **no customer notifications**.
