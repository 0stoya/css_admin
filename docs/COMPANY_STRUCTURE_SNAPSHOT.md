# Company structure snapshot (Staff Admin)

**Download structure snapshot (.xlsx)** appears on a linked company's Overview
and Import / export pages.

## Workbook

The file contains a Summary sheet and one worksheet for each company in the
same visible parent/child structure. Each worksheet records:

- Company reference, name, Magento ID, parent, active state and public catalogue.
- Company users, assigned roles and an explicit role-membership table.
- Company roles with counts of their assigned users.
- The company-level product restriction flag and saved allowed SKU list.
- Role-level product selection mode and saved SKU list.

**No category information is exported.** The workbook is a snapshot of stored
settings, not a calculation of effective product eligibility.

Product restriction disabled and product restriction enabled with an empty
allowlist are explicitly distinguished. Saved SKUs are still visible when
their restriction flag is off, labelled as inactive configuration.

## Safety

Staff Admin authentication is required. All company information is read
through the existing authenticated Fluid Admin GraphQL methods. The canonical
group head must be in the visible company list; only its visible descendants
are exported. The tool cannot guarantee that a restricted Admin sees every
company in Magento.

The export performs no mutations, does not use customer-session selection,
and does not create a server-side snapshot file. Downloads have private,
no-store response headers.

The exporter uses 2 workers, issuing up to 4 concurrent GraphQL reads for
member details. If one company cannot be read or data identities disagree,
no workbook is returned.

Limits: 80 member companies, 250,000 total workbook rows (including headers).
Larger groups or SKU lists fail rather than silently produce partial data.
The workbook records the start and finish times in UTC; the reads are not an
atomic database snapshot. Names, emails and SKUs are inert Excel text.

## Test and acceptance

Run the product-only regression tests, TypeScript, lint and Next build:

- node --test tests/company-structure-snapshot.test.mjs
- yarn typecheck
- yarn lint
- yarn build

Browser: download from a group head and a child, confirm the same member sheets,
check role membership and product flags/SKUs, confirm independent companies
have no button, and confirm a scoped Admin cannot export unrelated companies.
