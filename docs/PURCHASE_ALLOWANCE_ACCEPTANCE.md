# Quantity allowance management — app acceptance

This app slice targets the deployed Fluid #87 allowance ledger. It does not change Magento rules, GraphQL operations, the period calculation, permissions, or the buyer/company-user ownership model.

## Changes

Both the staff company screen and company-user portal use shared rule input validation. Invalid dates, duplicate SKUs and integers outside GraphQL's range return action feedback before submitting a mutation. Magento still validates catalogue membership, role/template scope and permissions.

Save, assign, apply and reset have different notices. Apply/reset notices use the affected-user count returned by Magento rather than assuming anything changed. A zero count tells the operator to check role assignments and Template approval settings. Assignment with apply covers every eligible role linked to the template, not just the role currently being assigned.

Existing apply/reset confirmations remain required. Unassignment with the apply checkbox selected is rejected instead of reporting a misleading apply result. The checkbox value `false` is not treated as checked. A false backend delete result is not reported as success. Expired-session navigation and backend permission errors remain intact. Portal action feedback returns to the matching workspace.

A collapsed “How quantity allowances work” guide appears on both screens. It explains the buyer/Employee distinction, saving versus applying, date-preserving manual resets, backend-authoritative remaining quantities and retained history/legacy refund handling. The existing allowance and history queries already receive the corrected Fluid #87 results, so no additional read API or local balance calculation is introduced.

## Automated checks

After installing this repository's existing dependencies:

```bash
node --test tests/purchase-controls.test.mjs
yarn lint
yarn typecheck
yarn build
```

The Node tests transpile the production helpers and server actions with the installed TypeScript development dependency. Next navigation/cache and GraphQL IO are explicit test doubles; no Magento writes occur. They cover valid/invalid rule input, zero counts, confirmation requirements, save-only behaviour, assignment flags, permission errors and session expiry. These tests do not replace the full app build or live acceptance below.

## Required live acceptance

Use a disposable selected company and role. Test the staff and authorised company-user screens separately.

1. Save a rule such as four units over 365 days with a known catalogue SKU. Verify saving does not change an existing buyer's applied allowance or consumption. Invalid calendar dates and duplicate SKUs should show form feedback, not an unhandled route error.
2. Assign without Apply. Verify the notice and that existing applied rows are unchanged. Set the test buyer's approval setting to Template in the existing management screen, then apply explicitly. Compare the affected-user count with Magento; test a template with no eligible users as well.
3. Review Allowances before and after a real test purchase. Verify limit, start date, duration, consumed and usable remaining quantities match GraphQL. Test a future and an expired allowance; both must show Magento's zero usable remaining quantity without claiming all checkout is prohibited.
4. Save without apply, apply after purchasing, and reset separately. Verify history remains available after reapplication/reset. Manual reset does not change dates or activate future/expired allowances. Refund a new current-period purchase, then one from a closed period; the latter must not replenish the newer balance. Imported legacy refunds follow the backend's documented reconciliation policy.
5. Verify view-only and denied roles, guessed cross-company IDs and expired sessions. No frontend test can prove the deployed backend ACL boundary.
6. Check keyboard access to the new guide and existing forms, narrow viewport layout, and the main users/roles/catalogue flows.

Full lint/typecheck/build and live Magento/browser acceptance must be recorded on the PR before merge. Existing list pagination and bulk-import UX are not redesigned in this slice.
