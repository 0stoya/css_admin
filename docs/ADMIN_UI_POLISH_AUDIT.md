# Admin UI polish and contextual-help audit

## Scope

This audit covers the **Magento-administrator surface only**: `app/(admin)`. The Company Portal under `app/(portal)` is deliberately out of scope.

The first admin-wide polish pass uses shared presentation rather than rewriting every route:

- an `admin-shell` boundary keeps the visual layer away from the Company Portal;
- the Admin sidebar gains consistent Lucide navigation icons while retaining the CSS yellow active marker;
- common headings, cards, tables, search fields, badges and notices receive a light consistency pass;
- route-aware `(i)` help appears beside the page `h1` only where policy, ownership or workflow semantics are not obvious;
- purchase controls keep their existing specialist help modal and are not given a second help trigger.

No GraphQL operation, server action, permission check, form payload, allowance calculation or Magento/Fluid behaviour changes in this pass.

## When to use an `(i)` trigger

Use contextual help when the page contains at least one of these:

1. **Source-of-truth boundaries** — for example OGL-owned versus Magento-local data.
2. **Policy semantics** — for example approval types, catalogue boundaries or payment modes.
3. **Non-obvious identity/scope** — for example company users versus beneficiary Employees or an acting company user.
4. **Guarded workflow stages** — for example Preview versus Apply or Fetch versus Queue.
5. **A metric whose name can be misread** — for example OGL order-value “spend”.

Do **not** add `(i)` merely because a page has a title. Simple directories and overview dashboards should remain quiet.

## Route-by-route decision

| Admin route | `(i)` | Reason / content |
| --- | --- | --- |
| `/companies` | No | Company directory/search is self-explanatory; the existing “Authenticated Magento scope” copy is enough. |
| `/companies/[id]` | No | Overview is a read-only summary; structure and integration panels already explain their own state. |
| `/companies/[id]/finance` | **Yes** | Clarify that spend means OGL order value, the page is read-only, and it is not an accounting ledger/credit balance. |
| `/companies/[id]/management` | **Yes** | Explain company users versus Employees, role permissions, manager relationships and per-user approval settings. |
| `/companies/[id]/employees` | **Yes** | Explain non-login beneficiaries, manager scope, attributed product-spend semantics and that buyer allowances are not Employee allowances. |
| `/companies/[id]/catalog` | **Yes** | Explain the company catalogue as the maximum boundary, role restrictions as narrowing only, and public catalogue as separate. |
| `/companies/[id]/purchase-controls` | Existing help | Keep the dedicated purchase-control help modal; do not add the generic admin help trigger. |
| `/companies/[id]/payment` | **Yes** | Explain Platform default versus All versus Specific methods and that backend availability can change. |
| `/companies/[id]/credit` | **Yes** | Explain read-only Fluid balances, over-limit policy and the separation from credit-order approval. |
| `/companies/[id]/credit-orders` | **Yes** | Explain read-only default, acting-company-user authorization and actions returned by Fluid. |
| `/companies/[id]/credit-orders/[number]` | **Yes** | Same actor model plus lifecycle/payment-detail constraints on the individual order. |
| `/companies/[id]/pricing` | **Yes** | Explain OGL custom-price precedence, Magento fallback, import health and tier data provenance. |
| `/companies/[id]/import-export` | **Yes** | Explain `company_ref`, Preview-before-Apply and guarded single-company CSV writes. |
| `/companies/[id]/personalisation` | **Yes** | Explain CSS-owned presentation fields versus OGL-authoritative representative assignment and backend visibility. |
| `/companies/[id]/settings` | **Yes** | Explain synced read-only company data, Magento-local settings, hierarchy ownership and the separated danger zone. |
| `/bulk-import` | **Yes** | Explain multi-company `company_ref` routing, Preview-before-Apply and relationship ordering. |
| `/ogl` | **Yes** | Explain Fetch registry, sync eligibility, queue/import behaviour, mappings and overrides. |
| `/ogl/rep-profiles` | **Yes** | Explain that profile data is presentation-only and never changes the rep-code-to-admin mapping. |

## Help content ownership

The route matcher lives in `lib/admin-context-help.ts`. It is intentionally a pure data module so the route coverage can be regression-tested without rendering Next.js.

`components/admin-context-help.tsx` places the trigger beside the existing page `h1` and reuses the native dialog used by purchase controls. This gives the admin UI one keyboard/focus/backdrop model rather than creating another modal implementation.

The matcher deliberately returns no topic for:

- `/companies`;
- a bare `/companies/[id]` overview;
- `/companies/[id]/purchase-controls`;
- any `/portal/...` route.

## Visual-system pass

The shared visual layer is `app/admin-visual-polish.css` and every selector is rooted at `.admin-shell`.

This pass standardises, without changing layout semantics:

- page-title spacing and readable subtitle width;
- card/table borders and shadows;
- operational table header and row-hover treatment;
- search-field affordance;
- badge/button radius consistency;
- notice/error surface depth;
- Admin sidebar icon columns and active-icon colour;
- contextual-help trigger/cards/footer;
- responsive help layout and reduced-motion behaviour.

Existing page-specific CSS modules remain authoritative for specialised grids, charts, forms, queue rows and responsive layouts. The visual layer should not turn operational tables into oversized marketing cards.

## Follow-up candidates after browser review

Only do these when a real page looks materially inconsistent; do not mechanically redesign every screen:

- convert inline create/edit disclosures to the shared modal pattern where they consume too much vertical space;
- add compact Lucide icons to page-specific tabs when they improve scanning, following purchase controls;
- simplify destructive disclosures that visually dominate normal workflows;
- add search/clear affordances where filters are frequently used;
- tighten redundant metric strips when the same information is already visible in the primary table/card.

These should remain presentation changes unless a separate product requirement explicitly changes behaviour.

## Acceptance checklist

Run from the real application checkout:

```bash
node --test tests/admin-ui-polish.test.mjs
node --test tests/purchase-controls.test.mjs tests/purchase-control-modals.test.mjs
yarn lint
yarn typecheck
yarn build
```

Browser-check the Admin surface at desktop, narrow widths and zoom:

- sidebar icons, active marker and long labels;
- Companies and Company overview remain free of unnecessary help icons;
- each audited policy/workflow page gets exactly one page-level contextual-help trigger;
- Purchase controls keeps only its existing specialist info trigger;
- contextual dialogs restore focus and remain keyboard accessible;
- cards/tables/search fields remain readable at operational density;
- Company Portal routes and presentation are unchanged.
