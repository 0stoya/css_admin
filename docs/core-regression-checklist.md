# CSS Admin core regression checklist

Use this checklist after the functional core is merged and before beginning broad UI/UX refinement.

Acceptance authority is the real environment against the deployed Fluid/Magento backend. GitHub status alone is not acceptance.

## 1. Build gate

Run from the deployed candidate branch/release:

```bash
yarn lint
yarn typecheck
yarn build
```

- [ ] `yarn lint` passes.
- [ ] `yarn typecheck` passes.
- [ ] `yarn build` passes.
- [ ] Production build contains `/companies`, `/bulk-import`, `/ogl`, `/portal`, `/portal/catalog`, and `/portal/purchase-controls`.

## 2. Authentication and session boundaries

### Staff

- [ ] Sign in with a normal Magento administrator username.
- [ ] Redirect is `/companies`.
- [ ] `/portal` is not authorized by the admin token.
- [ ] Sign out clears the admin session.
- [ ] Expire/invalidate the Magento admin token and trigger a request.
- [ ] The stale session is cleared and `/login?reason=expired` is shown.

### Company user

- [ ] Sign in with a Magento customer email.
- [ ] Redirect is `/portal`.
- [ ] `/companies` and other `css_admin_*` Staff surfaces are not authorized by the customer token.
- [ ] Sign out clears the company-user session.
- [ ] Expire/invalidate the customer token and trigger a request.
- [ ] The stale session is cleared and `/login?reason=expired` is shown.

### Login inference

- [ ] Email-shaped login identifiers use Company-user authentication.
- [ ] Non-email login identifiers use Staff authentication.
- [ ] Incorrect credentials return a clean authentication error without exposing raw credentials or tokens.

## 3. Staff navigation and company scope

Verify the primary Staff navigation:

- [ ] **Companies** opens `/companies`.
- [ ] **Bulk import** opens `/bulk-import`.
- [ ] **OGL** opens `/ogl`.
- [ ] Sign out works from the Staff shell.

For an unrestricted administrator, open one real company and verify every company entry point:

- [ ] Company settings & lifecycle.
- [ ] Import / export.
- [ ] Company management.
- [ ] Catalogue policy.
- [ ] Purchase controls.
- [ ] Payment configuration.
- [ ] Company credit.
- [ ] Pricing status.
- [ ] Credit orders.

For a scoped/restricted Magento administrator:

- [ ] `/companies` returns only companies allowed by the backend scope.
- [ ] Direct access to an out-of-scope company is rejected by the backend.
- [ ] A permitted company overview remains usable even when one optional area such as pricing is restricted.
- [ ] Each restricted management area fails closed or renders its restricted/error state; the frontend does not manufacture authorization.
- [ ] Bulk import cannot bypass company scope or backend ACLs.
- [ ] OGL operations remain limited by the accepted backend authorization contract.

## 4. Company-user capability boundaries

Test at least three company-user profiles where available: company administrator, limited/view-only role, and company member without management permission.

### Company context

- [ ] Membership list matches `css_company_context`.
- [ ] Switching company changes the selected Fluid company context.
- [ ] A user with no assigned companies receives the no-company state.

### Company management

- [ ] `can_view_users=false` hides user-management data/actions.
- [ ] `can_manage_users=false` permits view-only behavior where authorized and exposes no user writes.
- [ ] `can_view_roles=false` hides role-management data/actions.
- [ ] `can_manage_roles=false` permits view-only behavior where authorized and exposes no role writes.
- [ ] Company administrators remain protected from removal.
- [ ] Non-assignable/protected ACL resources remain protected.

### Catalogue

- [ ] Catalogue navigation appears only when `can_manage_catalog_visibility=true`.
- [ ] Direct `/portal/catalog` access without capability renders restricted/fails closed.
- [ ] Authorized catalogue writes remain scoped to the selected company.

### Purchase controls

- [ ] Purchase-controls navigation appears only when `can_view_purchase_controls=true`.
- [ ] View-only roles can read templates/allowances/history but see no management actions.
- [ ] `can_manage_purchase_controls=true` exposes template/assignment actions.
- [ ] Direct `/portal/purchase-controls` access without view capability renders restricted/fails closed.

## 5. Destructive and high-impact action protection

### Staff

- [ ] Company deletion requires exact company reference and Fluid still rejects OGL-backed deletion while sync is enabled.
- [ ] Company-user removal requires the exact email and protects the company administrator.
- [ ] Role deletion requires the exact role name and unused-role backend rules still apply.
- [ ] Purchase-template deletion requires the exact template name.
- [ ] Applying a purchase template to eligible users requires explicit **Confirm overwrite**.
- [ ] Resetting purchase counters requires explicit **Confirm counter reset**.

### Company Portal

- [ ] Company-user removal requires the exact email and protects the company administrator.
- [ ] Role deletion requires the exact role name and protected roles remain non-manageable.
- [ ] Purchase-template deletion requires the exact template name.
- [ ] Applying a purchase template requires explicit **Confirm overwrite**.
- [ ] Resetting purchase counters requires explicit **Confirm reset**.

## 6. Import/export regression

### Single-company files

- [ ] Users current/example CSV downloads open correctly.
- [ ] Roles & permissions current/example CSV downloads open correctly.
- [ ] Role product restrictions current/example CSV downloads open correctly.
- [ ] Company product restrictions current/example CSV downloads open correctly.
- [ ] A mismatched `company_ref` is rejected on a company-scoped page.
- [ ] Preview is mandatory before Apply.
- [ ] Created / Updated / Skipped / Error results are intelligible.
- [ ] Existing Magento customers are matched by email; CSV does not silently create Magento customer accounts.
- [ ] Protected ACL resources are preserved on role import.

### Multi-company bulk files

- [ ] A roles file containing at least two valid company references previews by company.
- [ ] `company_ref` routes each row to the correct company.
- [ ] Unknown company references are reported and block Apply.
- [ ] Preview errors block Apply.
- [ ] A backend failure for one company does not contaminate another company's transaction.
- [ ] Restricted administrators cannot use bulk import to bypass backend scope.

## 7. Credit-order regression

- [ ] Queue/list/filter/search works.
- [ ] Detail renders comments and lifecycle history.
- [ ] Actor selector contains real company users only.
- [ ] Approve/reject/cancel/place actions appear only from backend `can_*` flags.
- [ ] Terminal orders show no lifecycle actions.
- [ ] `approved_pending_payment` remains customer-owned and is not resumed/bypassed by Admin.

## 8. Empty/error-state spot checks

This is a functional pass, not the final visual redesign. Verify that each state is usable and does not crash the surrounding page.

- [ ] Company list with no rows.
- [ ] Company management with no users/roles.
- [ ] Catalogue with no selected restrictions/products.
- [ ] Purchase controls with no templates, allowances or history.
- [ ] Credit orders with no matches.
- [ ] Import preview with only skipped rows.
- [ ] Import preview with validation errors.
- [ ] Company overview when optional pricing access fails.
- [ ] Portal with no selected company.
- [ ] Portal with selected company but no management access.

## 9. Completion gate

- [ ] No frontend authorization workaround was introduced during regression fixes.
- [ ] No manual company-creation flow exists; onboarding remains OGL-only.
- [ ] Company credit remains read-only.
- [ ] Pricing remains read-only/backend-authoritative.
- [ ] All issues found above are either fixed or explicitly moved to the UI/UX backlog because they are presentation-only.
- [ ] Final runtime walk-through is accepted.

When this checklist is green, start the dedicated UI/UX phase. Do not reopen core business logic unless UI work exposes a genuine backend contract defect.
