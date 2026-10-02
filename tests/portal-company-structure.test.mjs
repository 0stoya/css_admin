import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (file) => readFileSync(path.join(root, file), "utf8");

test("Portal consumes the Fluid customer company-structure contract", () => {
  const graphql = source("lib/graphql/company-portal.ts");
  const page = source("app/(portal)/portal/company-structure/page.tsx");

  assert.match(graphql, /css_company_structure/);
  assert.match(graphql, /root_company_id/);
  assert.match(graphql, /parent_company_id/);
  assert.match(graphql, /export async function getCompanyPortalStructure/);

  assert.match(page, /getCompanyPortalStructure\(\)/);
  assert.match(page, /buildCompanyStructure/);
  assert.match(page, /Current company/);
  assert.doesNotMatch(page, /temporary-portal-company-structure/);
  assert.doesNotMatch(page, /getTemporaryPortalCompanyStructure/);
});

test("Company structure navigation and direct route remain company-admin-only", () => {
  const layout = source("app/(portal)/layout.tsx");
  const page = source("app/(portal)/portal/company-structure/page.tsx");

  assert.match(layout, /capabilities\?\.is_company_admin/);
  assert.match(layout, /href: "\/portal\/company-structure", label: "Company structure"/);
  assert.match(page, /!administration\?\.is_company_admin/);
  assert.match(page, /administration\.company_id !== selected\.company_id/);
  assert.match(page, /notFound\(\)/);
});

test("group-head Portal finance aggregates only the Fluid-authorised root structure", () => {
  const profile = source("app/(portal)/portal/company-profile/page.tsx");

  assert.match(profile, /getCompanyPortalStructure\(\)/);
  assert.match(profile, /findCompanyPortalStructureContext/);
  assert.match(profile, /structureContext\.root\.company\.company_id === selected\.company_id/);
  assert.match(profile, /structureContext\.root\.company\.parent_company_id === null/);
  assert.match(profile, /structureContext\.root\.children\.length > 0/);
  assert.match(profile, /getLatestCompanyFinanceSnapshotsForCompanies/);
  assert.match(profile, /missing companies are not treated as zero spend/);
  assert.match(profile, /Group head view/);
});

test("permanent branch contains no temporary snapshot runtime dependency", () => {
  const env = source(".env.example");
  const profile = source("app/(portal)/portal/company-profile/page.tsx");

  assert.doesNotMatch(env, /CSS_ADMIN_PORTAL_STRUCTURE_SNAPSHOT/);
  assert.doesNotMatch(profile, /temporary-portal-company-structure/);
  assert.doesNotMatch(profile, /CSS_ADMIN_PORTAL_STRUCTURE_SNAPSHOT/);
});


test("structure company switching is limited to existing customer memberships", () => {
  const actions = source("app/(portal)/portal/actions.ts");
  const page = source("app/(portal)/portal/company-structure/page.tsx");

  assert.match(page, /selectPortalCompanyAction/);
  assert.match(page, /context\?\.companies\.map\(\(company\) => company\.company_id\)/);
  assert.match(page, /switchableCompanyIds\.includes\(node\.company\.company_id\)/);
  assert.match(page, /name="returnTo" value="\/portal\/company-structure"/);
  assert.match(page, /currentPositionLabel/);
  assert.match(page, /"Group company"/);

  assert.match(actions, /await selectCompanyPortalCompany\(companyId\)/);
  assert.match(actions, /returnToStructure && isCompanyAdminAfterSwitch/);
  assert.match(actions, /redirect\("\/portal\/company-structure"\)/);
  assert.match(actions, /revalidatePath\("\/portal\/company-structure"\)/);
});
