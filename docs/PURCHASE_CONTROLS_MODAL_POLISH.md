# Purchase-control editing and help modals

## Scope

UI follow-up to css_admin #69, based on `a26dc1e8a4aa3ae2d7e852e2acfd29efd1ca4c3e`.

The staff Templates heading is now `Purchase-control templates` followed by a Lucide Info button. The existing explanatory subtitle is unchanged. Help opens in a labelled native dialog rather than a full-width accordion at the bottom of the screen. The shared company-portal help also receives the new modal presentation; its existing portal template-management modal is unchanged.

The selected staff template has an Edit template button alongside its status and Close action. Edit opens a wide dialog using the existing catalogue product picker and quantity-rule editor. This is edit-only; the Create route, assignments, Apply/Reset confirmations, allowances, history, pagination and imports are unchanged.

A dedicated edit server action reuses the existing input helpers, Magento-admin GraphQL client and backend scope/ACL checks. It requires both company and template IDs and only calls the template-save mutation. It never applies the template or resets buyer usage. Backend/validation errors stay inside the open editor; the controlled name and existing controlled rule rows retain the draft. Successful save revalidates the company screen, closes the dialog and returns to the same selected template/search with an explicit save-only notice.

Cancel or Escape dismisses the draft; reopening uses the latest supplied saved values. Clicking outside an edit dialog does not discard it. Pending saves disable fields, save, cancel, close and Escape dismissal to avoid accidental repeat submissions. Help permits backdrop dismissal. Both dialogs restore focus and background scroll on close; native `showModal()` supplies top-layer placement, inert background and keyboard focus containment.

`lucide-react` is pinned to **1.44.0**, the version already used in css_store. Run `yarn install` in the real app checkout before the build checks. No lockfile was previously tracked in the reviewed app tree; follow the repository's existing lockfile policy. No other dependency versions change.

## Stacked quantity limits are separate backend work

The requested example is **10 of a product in 365 days AND at most 2 of that same product in 30 days**. This PR does not implement or pretend to offer it.

The current backend has one rule per template/product and one current applied allowance per buyer/product. Adding duplicate SKU rows or assigning another template is not a supported way to stack limits. Duplicate-SKU validation remains in place.

A follow-up under `Css/Commerce/**` needs explicit multi-window semantics, both checks enforced together, period-aware consumption/refunds and a compatible GraphQL contract before the admin can offer an additional-limit control. Confirm whether the 30-day window means fixed periods from a start date or any rolling 30 days. Preserve the existing approval-versus-hard-block behaviour unless a separate policy change is explicitly agreed. Do not infer or implement buyer/employee scope or authorization in this app.

## Validation

Completed in the isolated development environment:

- Original modified files matched their Git blob hashes before editing.
- 25 focused Node tests pass, using actual input helpers and edit/dialog source with explicit Next/GraphQL/React/DOM infrastructure doubles.
- Changed TS/TSX files transpile without syntax diagnostics; CSS parses; whitespace checks pass.

This environment cannot resolve GitHub/npm hosts for clone or package installation. These checks are not a full Next.js/TypeScript build, a real React browser run or live Magento acceptance.

Run on the real checkout:

```bash
yarn install
node --test tests/purchase-controls.test.mjs tests/purchase-control-modals.test.mjs
yarn lint
yarn typecheck
yarn build
```

Acceptance:

1. Staff Templates: Info is beside the title; subtitle is unchanged; no duplicate full-width help card. Test keyboard opening, Tab containment, Escape/backdrop/close/"Got it" and return focus.
2. Help: check the three-step guide, buyer-versus-Employee distinction, reset/start-date behaviour, retained history/legacy refund note and explicit stacked-limit limitation. Check the other staff tabs and company-portal help.
3. Edit: open a saved template; catalogue picker, add/remove rule and all existing inputs work. Cancel/Escape makes no API write; clicking the backdrop does not discard the draft.
4. Submit an invalid date/duplicate manual SKU or provoke Magento scope/permission errors. Error stays in the modal, is focused/announced and the entered name/rules remain. An expired session still navigates to sign-in.
5. Successful save: one mutation, modal closes, same template/search remains selected, updated definition is shown, existing buyer counters are unchanged. Check a slow request: pending labels and duplicate-submit protection.
6. Regress Create, Assign, Apply, Reset, Delete and current allowance/history reads against Fluid #87. Check narrow screens, long template names, zoom and reduced motion.

No Magento backend changes, new rule types or store changes are included. Nothing is deployed by opening this PR.
