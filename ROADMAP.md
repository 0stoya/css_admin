# CSS Admin roadmap

Last updated: 2026-09-05

## Goal

Build the functional Fluid/Magento Admin application against the accepted GraphQL contract first, then complete a dedicated UI/UX refinement pass.

The frontend must not reproduce Magento/Fluid authorization, company scope, catalogue eligibility, purchase-control validation or credit-order business rules. Those remain backend-authoritative.

## Validation gate

Every functional slice is accepted on the real Admin environment with:

```bash
yarn lint
yarn typecheck
yarn build
```

followed by a live runtime check against the deployed Fluid GraphQL backend.

GitHub Actions are not the current acceptance authority for this project.

## Product rule: company onboarding is OGL-only

The Admin app must **not** expose manual company creation.

The supported onboarding flow is:

**OGL registry -> live preview -> enable sync/import -> Magento company**.

The low-level `cssAdminCreateCompany` mutation may remain available in the backend compatibility contract, but it is not an Admin product workflow.

OGL-owned fields must stay out of the generic company edit surface because a later sync can overwrite them. This includes CREF/reference, OGL status, address/contact data, designated administrator/email and normal sales-representative assignment.

## Product rule: company credit is read-only

The Admin app may display the company credit account returned by Fluid, including limit, usage, remaining amount, currency and over-limit state, but must **not** expose credit writes.

The low-level `cssAdminSaveCompanyCredit` mutation may remain in the backend compatibility contract, but it is not an Admin product workflow and must not be called by this application.

## Completed core

### Foundation — PR #1

- [x] Next.js 16 App Router / React 19 / TypeScript foundation.
- [x] server-side Magento admin token exchange.
- [x] HttpOnly admin session cookie.
- [x] server-side typed GraphQL fetch layer.
- [x] login/logout routes.
- [x] scoped company list.
- [x] company detail and management-area availability.

### Company Management read — PR #2

- [x] `/companies/[id]/management`.
- [x] users, roles and Fluid ACL resources.
- [x] manager relationships and approval/capability state.
- [x] backend-returned `manageable` / `assignable` state respected.

### Company Management writes — PR #3

- [x] customer candidate search.
- [x] add/update/remove company users.
- [x] role/manager/approval settings.
- [x] approval type constrained to Fluid values: `all`, `template`, `value`, `none`.
- [x] create/update/delete company roles.
- [x] destructive confirmations.

### Catalogue Policy — PR #4

- [x] `/companies/[id]/catalog`.
- [x] company public/category/product catalogue policy.
- [x] role category policy.
- [x] role product narrowing within the company catalogue.
- [x] product controls respect the company catalogue as the hard upper bound.
- [x] Fluid PR #57 compatibility accepted: role products may be narrowed without requiring a role category restriction.

### Purchase Controls — PR #5

- [x] `/companies/[id]/purchase-controls`.
- [x] read purchase-control templates and SKU rules.
- [x] create/update/delete templates.
- [x] assign/unassign templates to company roles.
- [x] optional apply-to-users flow.
- [x] reset counters.
- [x] current applied allowances.
- [x] purchase-control consumption history.

The current purchase-control rule editor is intentionally functional. A richer SKU selector/modal is deferred to the UI pass.

### OGL administration — PR #6

- [x] `/ogl` registry/search/filtering.
- [x] fetch OGL company references into the local registry.
- [x] live OGL company preview before import.
- [x] enable/disable sync; enabling queues an immediate import.
- [x] queue selected sync-enabled CREFs or all enabled CREFs.
- [x] OGL rep-code -> Magento admin mappings.
- [x] imported-company rep overrides.
- [x] backend ACL/config/error states shown without duplicating OGL rules in the frontend.

Functional acceptance passed on the real Admin environment. UI/UX refinement remains deferred to the later dedicated pass.

### Company configuration/lifecycle — PR #7

- [x] `/companies/[id]/settings` local settings/lifecycle screen.
- [x] customer-group selector from the backend company-options contract.
- [x] Magento-local VAT/parent/comment/description/homepage/landing-page fields.
- [x] read-only presentation for OGL-owned identity/contact/status/admin/sales-rep fields.
- [x] exact-reference company deletion.
- [x] OGL sync-enabled deletion rejected by Fluid PR #58.
- [x] successful sync-disabled deletion retains the CREF registry row and clears its imported company ID.
- [x] restricted admins remain backend-authoritative rather than gaining client-inferred write access.

Company settings persistence and the destructive disposable-company lifecycle both passed on the real environment. Fluid PR #58 is therefore accepted for the guarded OGL-backed delete flow.

### Payment configuration — PR #8

- [x] `/companies/[id]/payment` payment configuration screen.
- [x] read `is_configured`, `is_specific`, allowed methods and backend-provided payment options.
- [x] save payment flags and selected method codes through `cssAdminSaveCompanyPaymentConfiguration`.
- [x] preserve backend validation for unknown methods and empty specific-method selections.
- [x] only Magento-active payment methods are returned/accepted after Fluid PR #59.
- [x] restricted admins remain backend-authoritative.

Runtime acceptance passed on the real Admin environment. Fluid PR #59 fixed the app-discovered disabled-payment-method contract defect and is accepted.

## Current core slice: company credit visibility

Company credit is a read-only Admin product surface even though the backend compatibility schema contains a write mutation.

- [ ] `/companies/[id]/credit` read-only company credit screen.
- [ ] display credit account existence, credit ID and currency.
- [ ] display backend-returned credit limit, used amount and remaining amount without client-side calculation.
- [ ] display the backend-returned allow-over-limit state as informational only.
- [ ] do not add a save action, edit form or call to `cssAdminSaveCompanyCredit`.
- [ ] probe credit availability separately from payment because the backend credit ACL is distinct.
- [ ] restricted admins remain backend-authoritative rather than gaining client-inferred access.

## Remaining core — priority order

### 1. Commercial configuration

After read-only company credit is accepted:

- [ ] company product discounts.

### 2. Admin credit orders

- [ ] company credit-order queue/list/filter/search.
- [ ] detail view.
- [ ] comments.
- [ ] lifecycle/history.
- [ ] actor-aware allowed actions.
- [ ] approve/reject/cancel/place/PO-number actions where the backend authorizes them.
- [ ] payment-resume handling only if the configured business flow actually produces `approved_pending_payment`.

### 3. Core-completion pass

Before broad UI polish:

- [ ] verify all company-detail cards link to implemented surfaces.
- [ ] normalize loading/error/empty states.
- [ ] check scoped-sales-representative versus unrestricted-admin behavior across every route.
- [ ] verify destructive confirmations consistently protect important writes.
- [ ] remove any obsolete availability probes once full screens replace them.
- [ ] run final lint/typecheck/build and live regression walk-through.

## Deferred UI/UX refinement

Once the core Admin surface is complete, perform a dedicated UI pass without changing backend business rules.

Known candidates:

- [ ] replace raw Magento admin IDs in OGL rep mapping/override forms with richer admin selectors.
- [ ] purchase-control SKU picker/modal instead of raw `SKU | quantity | duration | date` text lines.
- [ ] catalogue product search/select controls and clearer role add/remove presentation.
- [ ] company-user and role forms with stronger layout and contextual controls.
- [ ] company settings/lifecycle layout, richer parent-company selector and destructive confirmation UX.
- [ ] payment configuration interaction/layout refinement after functional acceptance.
- [ ] company-credit presentation refinement after functional acceptance.
- [ ] tables, filters, pagination and mobile/responsive behavior.
- [ ] navigation hierarchy / breadcrumbs / section layout.
- [ ] consistent buttons, badges, form controls, confirmation dialogs and feedback states.
- [ ] accessibility/keyboard/focus pass.

The rule for this phase is **improve interaction and presentation, not duplicate Fluid validation or ACL logic in the browser**.

## Backend compatibility rule

If a screen exposes a legitimate contract defect, fix it in `0stoya/Fluid` and validate it on Magento rather than adding a frontend workaround.

Accepted/discovered examples:

- Fluid PR #57 fixed admin role-product catalogue boundaries discovered while building Admin catalogue policy.
- Fluid PR #58 adds OGL-aware company deletion discovered while defining the Admin company lifecycle; its destructive lifecycle acceptance passed with Admin PR #7.
- Fluid PR #59 restricts the headless company-payment option/validation boundary to Magento-active methods; runtime acceptance passed with Admin PR #8.

## After Admin

When the Admin core and UI baseline are stable:

1. start the separate Customer app against the accepted customer GraphQL surface;
2. build the Kiosk app later as its own product/repository;
3. extract shared frontend packages only if actual duplication justifies them.

## Immediate next slice

**Company credit visibility: read backend credit state -> display only -> verify credit ACL boundary.**

After acceptance, continue with **company product discounts**.
