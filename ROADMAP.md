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

## Remaining core — priority order

### 1. Company create/update/delete

Close the base company-management gap before moving deeper into commercial/admin operations.

Target existing Fluid admin company operations and options for:

- [ ] create company.
- [ ] update company identity/configuration.
- [ ] customer group / sales representative selection where exposed by the backend.
- [ ] activate/deactivate state where supported.
- [ ] delete company with explicit destructive confirmation and backend validation.

Do not infer fields or rules from Magento UI behaviour; use the actual Fluid GraphQL schema.

### 2. Commercial configuration

Build one focused block at a time:

- [ ] payment configuration.
- [ ] company credit-limit configuration.
- [ ] company product discounts.

Credit balance mutation must not be invented if the backend intentionally exposes configuration only.

### 3. OGL administration

- [ ] OGL company registry/search.
- [ ] preview/import company.
- [ ] sync controls/status.
- [ ] sales-representative mapping.
- [ ] relevant destructive/retry actions exposed by Fluid.

### 4. Admin credit orders

- [ ] company credit-order queue/list/filter/search.
- [ ] detail view.
- [ ] comments.
- [ ] lifecycle/history.
- [ ] actor-aware allowed actions.
- [ ] approve/reject/cancel/place/PO-number actions where the backend authorizes them.
- [ ] payment-resume handling only if the configured business flow actually produces `approved_pending_payment`.

### 5. Core-completion pass

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

- [ ] purchase-control SKU picker/modal instead of raw `SKU | quantity | duration | date` text lines.
- [ ] catalogue product search/select controls and clearer role add/remove presentation.
- [ ] company-user and role forms with stronger layout and contextual controls.
- [ ] tables, filters, pagination and mobile/responsive behavior.
- [ ] navigation hierarchy / breadcrumbs / section layout.
- [ ] consistent buttons, badges, form controls, confirmation dialogs and feedback states.
- [ ] accessibility/keyboard/focus pass.

The rule for this phase is **improve interaction and presentation, not duplicate Fluid validation or ACL logic in the browser**.

## Backend compatibility rule

If a screen exposes a legitimate contract defect, fix it in `0stoya/Fluid` and validate it on Magento rather than adding a frontend workaround.

Example already accepted: Fluid PR #57 fixed admin role-product catalogue boundaries discovered while building PR #4.

## After Admin

When the Admin core and UI baseline are stable:

1. start the separate Customer app against the accepted customer GraphQL surface;
2. build the Kiosk app later as its own product/repository;
3. extract shared frontend packages only if actual duplication justifies them.

## Immediate next slice

**Company create/update/delete.**

After acceptance, continue with **payment configuration -> company credit -> discounts**.
