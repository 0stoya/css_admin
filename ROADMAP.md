# CSS Admin roadmap

Last updated: 2026-09-05

## Goal

Build the functional Fluid/Magento management application against backend-authoritative GraphQL contracts first, then complete a dedicated reusable UI/UX refinement pass.

The frontend must not reproduce Magento/Fluid authorization, company scope, catalogue eligibility, purchase-control validation, pricing rules or credit-order business rules. Those remain backend-authoritative.

## Validation gate

Every functional slice is accepted on the real environment with:

```bash
yarn lint
yarn typecheck
yarn build
```

followed by a live runtime check against the deployed Fluid GraphQL backend.

GitHub Actions are not the current acceptance authority for this project.

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

The application now supports two distinct authenticated principals:

- **Staff / Magento administrator** -> Magento admin token -> `css_admin_*` management surfaces.
- **Company user** -> Magento customer token -> customer/company GraphQL surfaces only.

Company users must never be treated as fake Magento admins and must never call `css_admin_*` operations with a customer token.

Company-user navigation and actions must be derived from Fluid-returned membership/capability/ACL state. A company administrator or selected role-authorized company user sees only the company-owned functions Fluid authorizes.

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
- [x] Fluid PRs #57-#60 runtime accepted where applicable.

### Admin credit orders — PR #12

- [x] queue/list/filter/search.
- [x] detail, comments and lifecycle history.
- [x] real company-user actor selection.
- [x] approve/reject/cancel/place rendered only from backend `can_*` flags.
- [x] terminal order correctly renders no lifecycle actions even for an approver-capable actor.
- [x] `approved_pending_payment` remains customer-owned; Admin does not bypass/resume it.
- [x] merged and runtime accepted.

### Session expiry hardening — PR #13

- [x] upstream Magento HTTP 401 centrally clears stale session state.
- [x] expired sessions redirect to `/login?reason=expired`.
- [x] login shows a clear session-expired message.
- [x] ordinary ACL/authorization errors do not log the user out.
- [x] merged and runtime accepted.

### Company-user authentication — PR #14

- [x] explicit Staff / Magento administrator login.
- [x] explicit Company user login using Magento customer tokens.
- [x] separate HttpOnly sessions and route boundaries.
- [x] `/companies` remains staff-only.
- [x] `/portal` remains company-user-only.
- [x] company context selection uses `css_company_context` / `cssSelectCompany`.
- [x] company-user capabilities come from `css_company_admin`.
- [x] merged and runtime accepted.

### Company-user management writes — PR #15

- [x] create/edit/delete company roles through customer-side Fluid mutations.
- [x] add/update/remove company users.
- [x] role, manager and approval settings.
- [x] company administrator protection remains Fluid-authoritative.
- [x] assignable/manageable resources remain Fluid-authoritative.
- [x] lint/typecheck/build and live write journey accepted.
- [x] merged (`ae4a3fa631c667c75f215c88c49bbfab484c6d62`).

## Import/export block — before broad UI/UX

Complete bulk/data portability after the portal capability model is settled and before the final visual redesign.

### Company users — CSV import/export

Planned portable identifiers:

- email;
- role name;
- manager email;
- approval type;
- approval threshold.

Rules:

- mandatory preview/dry-run before apply;
- Created / Updated / Skipped / Error reporting;
- first version links existing Magento customers only rather than silently creating customer accounts;
- company administrator replacement/removal is not allowed through bulk import;
- use portable identifiers rather than Magento database IDs where possible.

### Roles / catalogue / purchase controls

Expose the existing Fluid versioned controls bundle:

- `css_admin_company_controls_export`;
- `cssAdminImportCompanyControls`.

Support downloadable JSON plus mandatory dry-run/preview before apply. Preserve backend options for missing roles/templates where the accepted contract permits them.

### Export-only authoritative/operational data

Useful export surfaces may include:

- company credit;
- read-only pricing/import state;
- credit orders;
- purchase-control history.

Do **not** introduce matching imports for pricing, credit or operational history. Those remain backend/OGL authoritative.

OGL registry/company creation remains outside generic import flows.

## Core-completion pass

After portal expansion and import/export, before broad UI polish:

- [ ] verify all staff and company-user navigation targets implemented surfaces.
- [ ] normalize loading/error/empty states.
- [ ] verify unrestricted vs scoped Magento-admin behavior across all staff routes.
- [ ] verify company-user role/capability boundaries across all portal routes.
- [ ] verify destructive confirmations consistently protect important writes.
- [ ] remove obsolete availability probes.
- [ ] run final lint/typecheck/build and live regression walk-through.

## UI/UX refinement — intentionally after functional blocks

The UI pass should establish reusable patterns that can later inform the Customer app:

- responsive application shell and navigation hierarchy;
- capability-aware navigation states;
- tables, filtering, sorting and pagination;
- consistent forms, buttons, badges and feedback;
- file import/export and dry-run review patterns;
- confirmation dialogs and destructive-action patterns;
- richer Magento admin selectors for OGL rep mapping/override;
- SKU/product selectors for catalogue and purchase controls;
- company user/role management layout;
- payment, credit, pricing and credit-order presentation;
- lifecycle history presentation instead of raw JSON where useful;
- accessibility, keyboard and focus behavior.

The rule remains: **improve interaction and presentation, never duplicate Fluid validation or ACL logic in the browser**.

## Backend compatibility rule

If a legitimate screen exposes a missing capability or contract defect, fix it in `0stoya/Fluid` and validate it on Magento rather than adding a frontend authorization workaround.

Accepted examples:

- Fluid PR #57 — admin role-product catalogue boundary.
- Fluid PR #58 — OGL-aware company deletion.
- Fluid PR #59 — active Magento payment methods only.
- Fluid PR #60 — read-only Admin OGL pricing visibility.

## After the management baseline

When the Admin/company-management baseline and reusable UI system are stable:

1. build the separate Customer app against the accepted customer GraphQL surface;
2. build the Kiosk app later as its own product/repository;
3. extract shared frontend packages only when actual duplication justifies them.

## Resume point for next chat

Start in **`0stoya/css_admin`** with the import/export block:

1. company-user CSV export plus mandatory import preview/apply;
2. Fluid's versioned company-controls JSON export/import with mandatory dry-run;
3. export-only operational data where the existing backend contract supports it.

Then complete the final regression pass and UI/UX refinement.
