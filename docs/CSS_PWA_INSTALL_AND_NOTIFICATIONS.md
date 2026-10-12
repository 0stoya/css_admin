# CSS Commerce PWA foundation and user-bound notification contract

## PR #136 — installability only

Staff Admin and Company Portal can be installed separately from the existing
**same-origin** css_admin Next.js application:

| Surface | Manifest | App ID | Launch |
| --- | --- | --- | --- |
| Staff Admin | `/pwa/admin.webmanifest` | `/pwa/css-staff-admin` | `/companies` |
| Company Portal | `/pwa/portal.webmanifest` | `/pwa/css-company-portal` | `/portal` |

Their `id` values are distinct, even though both use scope `/` because Staff
routes such as `/companies`, `/jobs`, `/bulk-import` and Portal routes
`/portal/...` live on the same host. Both register the shared
`/sw.js` **only after passing the existing authenticated route layout**.

Installation is a progressive enhancement. Supporting browsers may display a
native install prompt. iOS/iPadOS users can use Share → Add to Home Screen.
The manifests and branded PNG icons are public and contain no session data.
Production installation and future Web Push require HTTPS.

**There is no push subscription, permission prompt, offline mode, or
notification delivery in PR #136.** The service worker only handles
`install`/`activate`. It has **no fetch event handler, Cache API,
background sync, or storage of GraphQL data**. It cannot save private
staff/customer pages, authenticated requests or export artifacts offline.
The existing in-app Export Jobs bell remains the only completion alert until
the follow-up push phase is shipped.

## User identity and notification boundaries (next PRs)

### Staff export notifications

The durable PostgreSQL `css_admin.export_job` table already binds each job to
`owner_admin_user_id`, resolved server-side using Fluid
`css_admin_current_user.user_id` at enqueue. The worker **must never**
deliver to Magento service account #35 merely because it executed the job.

Future Web Push subscription registration must:

- Require the normal Staff Admin session and resolve `user_id` from
  `currentStaffJobIdentity()` **server-side**. Do not take the Staff Admin ID
  from a hidden field, browser device ID, URL or company selector.
- Register one or more device subscriptions under
  `principal_type = staff_admin`, `principal_id = owner_admin_user_id`, with
  independently revocable preferences and an endpoint-hash uniqueness guard.
  Endpoint and encryption keys are private service data, not client-visible
  except to that authenticated browser. Store them in a protected database;
  consider encryption-at-rest and key rotation.
- When a job is committed `ready`, add a single idempotent notification
  outbox event using `(event_kind, job_id, owner_admin_user_id)`. A separate
  dispatcher sends it to **that owner's** valid, opted-in devices. The worker
  finishing a file must succeed even if push delivery fails.
- Notifications should say only something generic such as **"Your export is
  ready"**, without customer names, SKUs, email addresses, CSV data or private
  download links. The click target is same-origin `/jobs`; the existing
  endpoint still checks the live Staff Admin identity and current company
  scope before any file IO. No push message grants access.
- Require a user gesture before requesting browser notification permission;
  provide explicit opt-in/out and device revocation. On a shared device, a
  login by another user must unlink the old principal's subscription (never
  associate one endpoint with multiple principals). Sign-out should attempt to
  revoke. A stale subscription should have bounded expiry/reverification and
  carry no sensitive details.

### Company/customer approval notifications

Do **not** use Magento Staff Admin IDs or just `is_company_admin` to choose
Company Admin recipients. Customer identities and approval eligibility are
independent:

- The Company Portal's existing
  `css_company_context` provides authenticated `customer_id`,
  `selected_company_id` and `selected_company_user_id`, while the selected
  company's membership must be active. Resolve them server-side from the
  customer token when registering a company notification subscription.
  A customer may have different company memberships on one device.
- Importantly, the live **approval queue is currently implemented in
  `css_store`**, at `/account/credit-orders?scope=APPROVAL`, not as a Portal
  approval action. The Store's existing `css_credit_orders(scope: APPROVAL)`
  and each order's `actions.can_approve`/`can_reject` are the authoritative
  customer-facing checks. Some Company Admins may not be permitted to approve
  an order, and an eligible approver need not have a generic admin label.
- A reliable **closed-app** push requires a trustworthy, idempotent order
  event feed from Magento/Store (or an approved read model). The current
  customer-scoped GraphQL order query alone does **not** provide a global
  recipient list or a background event source. Do not stash customer tokens,
  impersonate shoppers or guess recipients from company roles to implement
  push without the appropriate existing authorization contract.
- Dispatch to a customer device only when that exact recipient is established
  as an eligible approver in the relevant company. Deduplicate
  `(credit_order_id, approver_company_user_id, approval_generation)`; clear
  outstanding alerts when orders are approved/rejected/cancelled. On clicking
  `/account/credit-orders?scope=APPROVAL`, the Store rechecks the *current*
  customer token, selected company, order status and `actions.can_approve`.
- Never send order numbers, totals, buyer identity, basket contents or
  sensitive company details in lock-screen notifications. A generic
  **"An order needs your approval"** is sufficient.
- Because `css_store` uses a **different origin** from css_admin, its cookies
  and push subscriptions are not interchangeable. The Portal PWA could receive
  a customer-bound notification and link out to Store, but the order source and
  permission checks still belong to Store/Magento. A Store-specific PWA/push
  integration may be the cleaner user experience.

### Staged implementation after PR #136

1. **Staff Web Push:** private per-device subscription table, separate outbox,
   authenticated registration/revocation, VAPID secrets protected outside git,
   retry/dead-letter handling, privacy-only payload, opt-in UI, click → Jobs.
2. **Customer approval notification source:** validate the existing Store /
   Magento event and identity contracts, including cross-company approvers,
   multiple devices and order status changes. Keep this stage separate from
   Staff export notifications; a real event feed may require later backend
   cooperation.
3. **Customer Web Push:** authenticated customer opt-in, recipient filtering,
   deduplication, expiration, action landing in Store, and denial on revoked
   approval permissions.

No Fluid deployment is required for PR #136. Push phases remain opt-in, so a
future push failure must never block exports, orders or normal navigation.

## Test and release checklist

From an isolated worktree:

```bash
node --test tests/admin-pwa-foundation.test.mjs
yarn lint
yarn typecheck
yarn build
```

Production (only after green tests and review):

- Deploy from merged main with a clean worktree; **no PostgreSQL migration**,
  worker restart, VAPID keys or Fluid deployment in PR #136.
- Restart only `css-admin`; verify `/api/health` returns 200.
- Verify both public manifests return application/manifest+json and distinct
  `id`/`start_url` values. Verify `/pwa/icon/180`, `/192`, `/512` return
  PNGs with expected dimensions, and other icon sizes return 404.
- Verify `/sw.js` is not cached by intermediaries and that browser DevTools
  reports **no offline caches or intercepted requests**.
- On Chrome/Edge, test installation from Admin and Portal. On iPhone, test
  Share → Add to Home Screen, correct icon/title, launching to the right
  authenticated view, session expiry and logout. Reinstalling should not
  expose previous user data.
- The existing Jobs bell, large background CSV exports, Store and Kiosk must
  keep working unchanged.
