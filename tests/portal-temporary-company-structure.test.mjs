import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (file) => readFileSync(path.join(root, file), "utf8");

test("temporary Portal company structure is explicitly short-lived", () => {
  const bridge = source("lib/temporary-portal-company-structure.ts");
  const docs = source("docs/TEMP_PORTAL_COMPANY_STRUCTURE_SNAPSHOT.md");

  assert.match(bridge, /TEMPORARY QUICK-AND-DIRTY PRESENTATION BRIDGE/);
  assert.match(bridge, /temporary-portal-company-structure-snapshot-v1/);
  assert.match(bridge, /MAX_SNAPSHOT_LIFETIME_MS = 14 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(bridge, /Date\.parse\(snapshot\.expires_at\) <= Date\.now\(\)/);
  assert.match(bridge, /group_finance_company_ids/);
  assert.match(bridge, /isCanonicalGroupHead/);
  assert.match(bridge, /snapshot\.group_finance_company_ids\.includes\(companyId\)/);
  assert.match(docs, /Remove after the Fluid customer-authorised hierarchy API is deployed/);
  assert.match(docs, /presentation data only\. It is not an authorization source/);
});

test("Portal structure route remains company-admin-only with switching limited to existing memberships", () => {
  const layout = source("app/(portal)/layout.tsx");
  const page = source("app/(portal)/portal/company-structure/page.tsx");

  assert.match(layout, /capabilities\?\.is_company_admin/);
  assert.match(layout, /href: "\/portal\/company-structure", label: "Company structure"/);

  assert.match(page, /getCompanyPortalContext\(\)/);
  assert.match(page, /getCompanyPortalAdministration\(\)/);
  assert.match(page, /!administration\?\.is_company_admin/);
  assert.match(page, /administration\.company_id !== selected\.company_id/);
  assert.match(page, /notFound\(\)/);
  assert.match(page, /getTemporaryPortalCompanyStructure\(selected\.company_id\)/);
  assert.match(page, />Read only</);
  assert.match(page, /selectPortalCompanyAction/);
  assert.match(page, /context\?\.companies\.map\(\(company\) => company\.company_id\)/);
  assert.match(page, /switchableCompanyIds\.includes\(node\.company\.company_id\)/);
  assert.match(page, /name="returnTo" value="\/portal\/company-structure"/);
  assert.doesNotMatch(page, /href=\{?`?\/companies\//);
});

test("temporary snapshot stays server-side and fails closed", () => {
  const bridge = source("lib/temporary-portal-company-structure.ts");
  const env = source(".env.example");

  assert.match(bridge, /readFile\(\/\* turbopackIgnore: true \*\/ snapshotPath, "utf8"\)/);
  assert.match(bridge, /DEFAULT_SNAPSHOT_PATH = "\/etc\/css-admin\/portal-company-structure\.json"/);
  assert.match(bridge, /reason: "missing"/);
  assert.match(bridge, /reason: "invalid"/);
  assert.match(bridge, /reason: "expired"/);
  assert.match(bridge, /reason: "not-listed"/);
  assert.match(env, /TEMPORARY PRESENTATION BRIDGE/);
  assert.match(env, /CSS_ADMIN_PORTAL_STRUCTURE_SNAPSHOT=\/etc\/css-admin\/portal-company-structure\.json/);
});


test("temporary group finance is explicit, head-only and never treats missing children as zero", () => {
  const profile = source("app/(portal)/portal/company-profile/page.tsx");
  const bridge = source("lib/temporary-portal-company-structure.ts");
  const docs = source("docs/TEMP_PORTAL_COMPANY_STRUCTURE_SNAPSHOT.md");

  assert.match(bridge, /can_view_group_finance: isCanonicalGroupHead/);
  assert.match(profile, /structure\.can_view_group_finance/);
  assert.match(profile, /getLatestCompanyFinanceSnapshotsForCompanies/);
  assert.match(profile, /flattenCompanyStructure\(structure\.root\)/);
  assert.match(profile, /missing companies are not treated as zero spend/);
  assert.match(profile, /Group head view/);
  assert.match(profile, /View company structure/);
  assert.match(docs, /Child companies never inherit group finance/);
});


test("structure company switch uses existing Fluid membership enforcement and safe return path", () => {
  const actions = source("app/(portal)/portal/actions.ts");
  const page = source("app/(portal)/portal/company-structure/page.tsx");

  assert.match(actions, /await selectCompanyPortalCompany\(companyId\)/);
  assert.match(actions, /returnToStructure = String\(formData\.get\("returnTo"\)/);
  assert.match(actions, /returnToStructure && isCompanyAdminAfterSwitch/);
  assert.match(actions, /redirect\("\/portal\/company-structure"\)/);
  assert.match(actions, /revalidatePath\("\/portal\/company-structure"\)/);

  assert.match(page, /SwitchCompanyControl/);
  assert.match(page, /type="submit">Switch<\/button>/);
  assert.match(page, /currentPositionLabel/);
  assert.match(page, /"Group company"/);
});
