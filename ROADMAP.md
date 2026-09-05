# CSS Admin roadmap

Last updated: 2026-09-05

## Goal

Build the functional Fluid/Magento Admin application against the accepted GraphQL contract first, then complete a dedicated UI/UX refinement pass.

The frontend must not reproduce Magento/Fluid authorization, company scope, catalogue eligibility, purchase-control validation, pricing rules or credit-order business rules. Those remain backend-authoritative.

## Validation gate

Every functional slice is accepted on the real Admin environment with:

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

The supported onboarding flow is:

**OGL registry -> live preview -> enable sync/import -> Magento company**.

The low-level `cssAdminCreateCompany` mutation may remain available in the backend compatibility contract, but it is not an Admin product workflow.

OGL-owned fields must stay out of the generic company edit surface because a later sync can overwrite them. This includes CREF/reference, OGL status, address/contact data, designated administrator/email and normal sales-representative assignment.

### Company credit is read-only

The Admin app may display the company credit account returned by Fluid, including limit, usage, remaining amount, currency and over-limit state, but must **not** expose credit writes.

The low-level `cssAdminSaveCompanyCredit` mutation may remain in the backend compatibility contract, but it is not an Admin product workflow and must not be called by this application.

### Product pricing is backend-authoritative

The Admin app does **not** offer company discount or product-price CRUD.

Product pricing comes from the accepted Fluid/Magento pricing path:

- OGL/company-specific pricing where a company-specific price exists;
- otherwise the normal Magento product pricing path.

`Css\Commerce\Model\Pricing\CompanyPriceResolver` resolves Fluid's company-specific price model and returns `null` when no company-specific price exists, leaving the normal Magento pricing path authoritative.

The low-level admin company-discount GraphQL operations may remain in the compatibility schema, but they are **not** an Admin product workflow and must not be surfaced by this application.

## Completed core

### Foundation — PR #1

- [x] Next.js 16 App Router / React 19 / TypeScript foundation.
- [x] server-side Magento admin token exchange.
- [x] HttpOnly admin session cookie.
- [x] server-side typed GraphQL fetch layer.
- [x] login/logout routes.
- [x] scoped company list and company detail.

### Company Management read — PR #2

- [x] users, roles and Fluid ACL resources.
- [x] manager relationships and approval/capability state.
- [x] backend-returned manageable/assignable state respected.

### Company Management writes — PR #3

- [x] add/update/remove company users.
- [x] role/manager/approval settings.
- [x] create/update/delete company roles.
- [x] destructive confirmations.

### Catalogue Policy — PR #4

- [x] company public/category/product catalogue policy.
- [x] role category and product narrowing.
- [x] company catalogue remains the hard upper bound.
- [x] Fluid PR #57 compatibility accepted.

### Purchase Controls — PR #5

- [x] templates and SKU rules.
- [x] role assignment/application/reset.
- [x] applied allowances and consumption history.

### OGL administration — PR #6

- [x] OGL registry/search/filtering.
- [x] live preview.
- [x] sync enable/disable and import queueing.
- [x] rep-code mappings and imported-company overrides.

### Company configuration/lifecycle — PR #7

- [x] Magento-local company settings.
- [x] OGL-owned fields read-only.
- [x] exact-reference guarded delete.
- [x] Fluid PR #58 destructive lifecycle acceptance passed.

### Payment configuration — PR #8

- [x] company payment configuration screen.
- [x] backend-provided active payment methods only.
- [x] payment flags/method persistence.
- [x] backend validation retained.
- [x] Fluid PR #59 accepted.

### Company credit visibility — PR #9

- [x] read-only company credit screen.
- [x] credit account existence and credit ID.
- [x] credit limit, used amount, remaining amount and currency.
- [x] allow-over-limit state displayed informationally only.
- [x] no save action, edit form or credit mutation.
- [x] credit ACL probed independently from payment access.

Runtime acceptance passed on the real Admin environment.

## Current core slice: Admin credit orders

Build against the accepted explicit-company Admin credit-order contract. The backend remains authoritative for company scope, actor context and allowed actions.

- [ ] company credit-order queue/list/filter/search.
- [ ] detail view.
- [ ] comments.
- [ ] lifecycle/history.
- [ ] actor-aware allowed actions.
- [ ] approve/reject/cancel/place/PO-number actions only where Fluid authorizes them.
- [ ] payment-resume handling only if the configured business flow actually produces `approved_pending_payment`.

## Remaining core

### Core-completion pass

Before broad UI polish:

- [ ] verify all company-detail cards link to implemented surfaces.
- [ ] normalize loading/error/empty states.
- [ ] check scoped-sales-representative versus unrestricted-admin behavior across every route.
- [ ] verify destructive confirmations consistently protect important writes.
- [ ] remove obsolete availability probes once full screens replace them.
- [ ] run final lint/typecheck/build and live regression walk-through.

## Deferred UI/UX refinement

Once the core Admin surface is complete, perform a dedicated UI pass without changing backend business rules.

Known candidates:

- [ ] richer Magento admin selectors for OGL rep mapping/override.
- [ ] purchase-control SKU picker/modal.
- [ ] catalogue product search/select controls.
- [ ] stronger company-user and role form layout.
- [ ] company settings/lifecycle layout refinement.
- [ ] payment and company-credit presentation refinement.
- [ ] tables, filters, pagination and responsive behavior.
- [ ] navigation hierarchy / breadcrumbs / section layout.
- [ ] consistent buttons, badges, form controls, confirmation dialogs and feedback states.
- [ ] accessibility/keyboard/focus pass.

The rule for this phase is **improve interaction and presentation, not duplicate Fluid validation or ACL logic in the browser**.

## Backend compatibility rule

If a screen exposes a legitimate contract defect, fix it in `0stoya/Fluid` and validate it on Magento rather than adding a frontend workaround.

Accepted/discovered examples:

- Fluid PR #57: admin role-product catalogue boundary compatibility.
- Fluid PR #58: OGL-aware company deletion.
- Fluid PR #59: headless payment options restricted to Magento-active methods.

The pricing compatibility layer already includes `CompanyPriceResolver`, backed by Fluid company-specific pricing and returning no company-specific override when one does not exist. Do not replace that pricing source of truth with Admin-managed discount CRUD.

## After Admin

When the Admin core and UI baseline are stable:

1. start the separate Customer app against the accepted customer GraphQL surface;
2. build the Kiosk app later as its own product/repository;
3. extract shared frontend packages only if actual duplication justifies them.

## Immediate next slice

**Admin credit orders: queue/list/filter/search -> detail/history/comments -> actor-authorized lifecycle actions.**
