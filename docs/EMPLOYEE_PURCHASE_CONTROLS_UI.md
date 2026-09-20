# Employee Purchase Controls and Tiered Limits — Admin UI

Status: implementation tracker  
Started: 2026-09-20  
Backend contract: Fluid PR #95

## Goal

Extend the existing Purchase Controls and Employees workspaces so staff can configure and operate the Fluid backend contract for:

- canonical Employee purchase controls; and
- an optional rolling short-term cap alongside the existing main product allowance.

Example:

- Dust masks: 200 units / 365 days
- Short-term cap: max 5 units / rolling 7 days

Both limits are enforced by Fluid. This application only configures and reports the backend state.

## UI decisions

### Purchase-rule editor

Keep one row per SKU.

Existing fields:
- Product / SKU
- Quantity limit
- Duration days
- Start date

Add optional:
- Short-term max
- Rolling window days

The short-term fields are paired: both blank means no second tier; otherwise both must be positive integers. Fluid remains the final validator.

Do not represent tiers as duplicate SKU rows.

### Employees

Add a compact **Purchase controls** row action beside Edit / History.

Use the established Admin modal pattern. The modal shows:
- current template assignment;
- assignment-only versus Apply semantics;
- product allowance state;
- main used / remaining;
- rolling-cap used / remaining when configured;
- Apply and Reset actions with explicit consequences.

Employee remains a non-login beneficiary identity. Do not reuse company-user IDs or buyer copy.

### Semantics

- Assign only: changes assignment, does not change currently applied Employee allowances.
- Apply: materialises the assigned template and restarts main allowance periods.
- Unassign: removes future assignment only; existing applied allowances remain until another template is applied.
- Reset: resets main-period counters; rolling usage is based on purchase history and therefore does not reset.
- Buyer/company-user limits keep the existing approval model: exceeding the main or rolling limit routes the buyer decision to approval.
- Applied Employee limits are beneficiary entitlement constraints: approving the purchasing user does not override an Employee main or rolling limit.
- A rolling cap is shown as, for example, “4 of 5 in rolling 7 days”.
- Main allowance is shown independently, for example, “42 of 200 in current 365-day period”.

## Backend fields expected from Fluid #95

Purchase-control rules:
- `short_term_quantity_limit: Int`
- `short_term_duration_days: Int`

Applied buyer allowance:
- `short_term_quantity_limit`
- `short_term_duration_days`
- `short_term_purchases_so_far`
- `short_term_remaining_quantity`

Employee purchase-control state:
- `css_admin_company_employee_purchase_control(company_id, employee_id)`
- assignment fields
- current product allowance rows
- optional rolling-cap usage fields

Employee mutations:
- assign/unassign, optional immediate Apply
- Apply
- Reset

## Scope

### Phase A — GraphQL/types/forms
- extend purchase-control documents/types;
- extend rule serialization/validation;
- add Employee purchase-control query/mutations.

### Phase B — Purchase Controls UI
- add paired rolling-cap fields to the existing rule editor;
- display rolling caps in template and applied-allowance views;
- preserve existing Save / Assign / Apply / Reset semantics.

### Phase C — Employees UI
- add Purchase controls action/modal;
- assignment dropdown using existing company purchase-control templates;
- current allowance cards/table;
- explicit Apply and Reset actions;
- preserve filters/modal return state.

### Phase D — tests/acceptance
- parser/validation tests;
- GraphQL contract tests;
- Employee modal/action tests;
- lint/typecheck/build;
- live Fluid acceptance.

## Safety boundaries

- No purchase-limit calculation in Next.js.
- No local reconstruction of rolling usage from order history.
- No fake Employee login/user identity.
- No schema fallbacks that silently treat missing Fluid fields as success.
- Existing buyer-only templates with no second tier must continue to render and save unchanged.
- Portal changes are out of the initial Admin implementation unless explicitly required by the accepted Fluid contract.

## Acceptance

1. Main-only rule saves unchanged.
2. 200 / 365 plus 5 / 7 saves as one SKU rule.
3. Supplying only one short-term field is rejected before mutation and by Fluid.
4. Existing templates render blank short-term fields rather than fabricated values.
5. Applied buyer state shows both main and rolling usage when present.
6. Employee row opens Purchase controls modal.
7. Assignment without Apply clearly says current applied allowances are unchanged.
8. Apply refreshes Employee allowance rows.
9. Reset explains that main counters reset but rolling purchase-history usage does not.
10. Unassign does not imply removal of already-applied Employee allowances.
11. Employee modal remains manager/ACL scoped by Fluid.
12. Existing Employees Edit / History / Deactivate and Purchase Controls role flows regress cleanly.

## Merge gate

Do not mark ready until Fluid #95 contract is accepted enough for the app build, focused tests pass, and `yarn lint`, `yarn typecheck`, and `yarn build` pass on the real checkout.
