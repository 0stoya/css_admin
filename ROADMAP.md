# CSS Admin roadmap

Last updated: 2026-09-06

## Goal

Build the Fluid/Magento management application against backend-authoritative GraphQL contracts, refine it into a coherent Admin workspace, then harden the production serving boundary before moving on to the separate Customer app.

The frontend must not reproduce Magento/Fluid authorization, company scope, catalogue eligibility, purchase-control validation, pricing rules or credit-order business rules. Those remain backend-authoritative.

## Validation gate

Every functional slice is accepted on the real environment with:

```bash
yarn lint
yarn typecheck
yarn build
```

followed by a live runtime check against the deployed Fluid GraphQL backend.

GitHub Actions are useful signal, but the real Magento/Fluid environment remains the acceptance authority for this project.

## Product rules

### Company onboarding is OGL-only

The Admin app must **not** expose manual company creation.

Supported onboarding:

**OGL registry -> live preview -> enable sync/import -> Magento company**.

The low-level `cssAdminCreateCompany` mutation may remain available in the backend compatibility contract, but it is not an Admin product workflow.

OGL-owned fields stay out of generic company editing because later sync can overwrite them. This includes CREF/reference, OGL status, address/contact data, designated administrator/email and normal sales-representative assignment.

### Company credit is read-only

The Admin app may display company credit account state, but must **not** expose credit writes.

### Product pricing is backend-authoritative and read-only in Admin

The Admin app does **not** offer company discount or product-price CRUD.

Pricing comes from the accepted Fluid/Magento path:

- OGL/company-specific pricing where present;
- otherwise the normal Magento pricing path.

Read-only pricing/import visibility is allowed. Pricing mutations are not.

### Dual-principal management model

The application supports two distinct authenticated principals:

- **Staff / Magento administrator** -> Magento admin token -> `css_admin_*` management surfaces.
- **Company user** -> Magento customer token -> customer/company GraphQL surfaces only.

The shared sign-in form infers the principal from the login identifier: email-shaped logins use Magento customer authentication; non-email usernames use Magento administrator authentication. The resulting tokens and route boundaries remain separate.

Company users must never be treated as fake Magento admins and must never call `css_admin_*` operations with a customer token.

Company-user navigation and actions must be derived from Fluid-returned membership/capability/ACL state. A company administrator or selected role-authorized company user sees only the company-owned functions Fluid authorizes.

### Magento integration is GraphQL-only

Admin-to-Magento application integration must use the accepted GraphQL surface. Do not introduce new REST/Web API calls as shortcuts for Admin workflows.

If a legitimate screen exposes a missing capability, extend the Fluid GraphQL contract and validate it on Magento rather than creating a second integration path.

## Completed Admin core

### Foundation through company/commercial management — PRs #1-#11

- [x] Next.js 16 / React 19 / TypeScript foundation.
- [x] Magento admin authentication and HttpOnly session.
- [x] scoped company list/detail.
- [x] company users/roles read + writes.
- [x] catalogue policy.
- [x] purchase controls.
- [x] OGL administration.
- [x] company configuration/lifecycle.
- [x] payment configuration.
- [x] read-only company credit.
- [x] read-only company pricing visibility.
- [x] Fluid compatibility work runtime accepted where applicable.

### Admin credit orders — PR #12 and later refinements

- [x] queue/list/filter/search.
- [x] detail, comments and lifecycle history.
- [x] real company-user actor selection.
- [x] approve/reject/cancel/place rendered only from backend `can_*` flags.
- [x] terminal order correctly renders no lifecycle actions even for an approver-capable actor.
- [x] `approved_pending_payment` remains customer-owned; Admin does not bypass/resume it.
- [x] frozen quote items are exposed through GraphQL and shown on the order detail.
- [x] merged and runtime accepted.

### Session expiry hardening — PR #13

- [x] upstream Magento HTTP 401 centrally clears stale session state.
- [x] expired sessions redirect to `/login?reason=expired`.
- [x] login shows a clear session-expired message.
- [x] ordinary ACL/authorization errors do not log the user out.
- [x] merged and runtime accepted.

### Company-user authentication — PR #14 + login polish

- [x] Staff and Company user authentication use their respective Magento token endpoints.
- [x] separate HttpOnly sessions and route boundaries.
- [x] `/companies` remains staff-only.
- [x] `/portal` remains company-user-only.
- [x] company context selection uses `css_company_context` / `cssSelectCompany`.
- [x] company-user capabilities come from `css_company_admin`.
- [x] shared sign-in UI automatically routes email-shaped logins to Company user auth and username logins to Staff auth.

### Company-user management writes — PR #15

- [x] create/edit/delete company roles through customer-side Fluid mutations.
- [x] add/update/remove company users.
- [x] role, manager and approval settings.
- [x] company administrator protection remains Fluid-authoritative.
- [x] assignable/manageable resources remain Fluid-authoritative.
- [x] lint/typecheck/build and live write journey accepted.

### Portal catalogue and purchase controls — PR #16

- [x] capability-driven portal catalogue visibility and management.
- [x] capability-driven purchase-control read/manage surfaces.
- [x] selected-company customer context remains Fluid-authoritative.
- [x] customer users cannot call staff `css_admin_*` operations.

### Import/export and multi-company bulk operations — PRs #17-#19 and later UI refinements

- [x] company-user CSV import/export with mandatory preview before apply.
- [x] Created / Updated / Skipped / Error reporting.
- [x] existing Magento customers are linked by email rather than silently created.
- [x] company administrator protection remains enforced.
- [x] flat roles & permissions CSV generated from Fluid's live assignable resource tree.
- [x] role product-restriction CSV.
- [x] company product-restriction CSV.
- [x] `company_ref` is a safety lock on single-company imports.
- [x] Unlimited Admin bulk workflow routes multi-company rows by `company_ref`.
- [x] company hierarchy bulk import uses references rather than Magento IDs.
- [x] controls continue through Fluid dry-run/apply per company.
- [x] current/example CSV downloads are available for every supported import type.
- [x] company and bulk import workspaces use focused tabs and preserve preview state while switching views.

## UI/UX refinement — completed Admin workspace pass

The broad Admin UI/UX refinement pass is complete through OGL administration.

Accepted patterns now include:

- [x] branded login with automatic Staff vs Company-user routing.
- [x] responsive application shell and contextual company header.
- [x] persistent sidebar navigation with company-management sub-navigation.
- [x] URL-connected Bulk Import sub-navigation and workspace tabs.
- [x] company hierarchy/group presentation.
- [x] company overview workspace.
- [x] Users & roles workspace with searchable users and hierarchical permission picker.
- [x] Catalogue policy workspace with independent Product and Category restrictions.
- [x] Purchase controls workspace with catalogue-backed SKU selection.
- [x] Payment configuration workspace.
- [x] Company credit workspace.
- [x] Credit orders queue/detail workspace with Overview / Conversation / History.
- [x] Pricing workspace.
- [x] company Import / export workspace.
- [x] Company settings / lifecycle workspace.
- [x] multi-company Bulk Import workspace.
- [x] OGL administration workspace.
- [x] consistent buttons, badges, forms, empty/error states, CSV picker and destructive confirmation patterns.
- [x] large selectors use searchable/paged or bounded workspaces rather than uncontrolled long pages.
- [x] UI changes preserve backend-authoritative Fluid ACL and validation behavior.

Presentation can still receive small follow-up polish, but there is no remaining major Admin workspace redesign blocking production serving.

## Remaining regression/hardening checks

These remain validation work rather than a new UI phase:

- [ ] normalize any remaining loading/error/empty-state edge cases found by live regression.
- [ ] verify unrestricted vs scoped Magento-admin behavior across all Staff routes.
- [ ] verify company-user role/capability boundaries across all Portal routes.
- [ ] run a final full `yarn lint`, `yarn typecheck`, `yarn build` and live regression walk-through after production process/proxy setup.
- [ ] verify session expiry/logout, disabled/reset users and restart behavior through the final public HTTPS boundary.

The executable runtime matrix remains documented in [`docs/core-regression-checklist.md`](docs/core-regression-checklist.md).

## Next phase — production serving: PM2 + nginx

**This is the next implementation slice.**

Goal: run `css_admin` as a production Next.js service behind nginx with a predictable process lifecycle and no direct public Node listener.

### PM2 / application process

- [ ] decide and document the dedicated Unix service account that owns the runtime process and deployed files.
- [ ] build with the production environment and run the Next.js production server, not `next dev`.
- [ ] bind the Next.js listener to loopback only on the reserved Admin port.
- [ ] add a checked-in PM2 ecosystem/process definition with explicit working directory, environment and process name.
- [ ] use a single application instance initially unless measured load justifies clustering.
- [ ] configure PM2 startup integration so the app returns after reboot.
- [ ] save the PM2 process list only after the production definition is accepted.
- [ ] verify clean start, stop, reload/restart and host reboot behavior.
- [ ] document logs, log retention/rotation and the commands operators should use to inspect the process.
- [ ] avoid storing Magento/Admin secrets inside the PM2 config committed to Git.

### nginx / public HTTPS boundary

- [ ] add the production server block for the Admin hostname.
- [ ] terminate HTTPS at nginx and redirect HTTP to HTTPS.
- [ ] proxy only to the loopback Next.js listener.
- [ ] preserve the correct host/proto forwarding headers required by auth, redirects and CSRF/origin checks.
- [ ] set sensible proxy/body/timeouts for normal Admin requests and CSV imports without allowing unnecessarily large uploads.
- [ ] add baseline security headers appropriate for the application and verify they do not break Next.js assets/auth.
- [ ] ensure static Next.js assets and application routes behave correctly through the proxy.
- [ ] verify login/logout/session expiry through the canonical public origin.
- [ ] verify no Node/PM2 port is reachable directly from the public network.

### Acceptance gate for the production-serving slice

- [ ] `yarn lint` passes.
- [ ] `yarn typecheck` passes.
- [ ] `yarn build` passes.
- [ ] PM2 reports the expected production process healthy after restart.
- [ ] nginx configuration test passes before reload.
- [ ] canonical HTTPS login works for Staff and Company users.
- [ ] representative company-management GraphQL reads/writes work through nginx.
- [ ] CSV preview/apply works through nginx.
- [ ] reboot restores nginx + PM2 service without manual intervention.
- [ ] logs and operator runbook are documented.

Do not add another application-facing API layer during this phase. nginx is the HTTP boundary; Magento integration remains GraphQL-only.

## Backend compatibility rule

If a legitimate screen exposes a missing capability or contract defect, fix it in `0stoya/Fluid` and validate it on Magento rather than adding a frontend authorization workaround.

Recent accepted examples include:

- admin role-product restrictions remaining independent from role categories;
- GraphQL-only company-catalogue product search for purchase controls;
- role/product search respecting the company product boundary;
- frozen credit-order quote items exposed to the Admin detail view;
- OGL-aware company deletion, active payment-method filtering and read-only OGL pricing visibility.

## After the production Admin baseline

Once PM2/nginx deployment, restart behavior and the final regression pass are green:

1. treat the current Admin app as the production management baseline;
2. build the separate Customer app against the accepted customer GraphQL surface;
3. build the Kiosk app later as its own product/repository;
4. extract shared frontend packages only when actual duplication justifies them.

## Resume point for next chat

Start in **`0stoya/css_admin`** with the **PM2 + nginx production-serving slice**:

1. inspect the current server/runtime user, installed Node/Yarn/PM2/nginx versions and the reserved local port;
2. define the production `yarn build` + Next.js start command and loopback binding;
3. add the PM2 process definition and verify restart/reboot persistence;
4. add the nginx HTTPS reverse-proxy boundary for the canonical Admin hostname;
5. run the production acceptance gate and then the full Admin regression checklist through HTTPS.
