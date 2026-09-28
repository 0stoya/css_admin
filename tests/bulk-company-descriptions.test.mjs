import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (file) => readFileSync(path.join(root, file), "utf8");

test("bulk company descriptions use a narrow three-column CSV contract", () => {
  const lib = source("lib/company-description-import.ts");

  assert.match(
    lib,
    /const HEADERS = \["company_ref", "company_name", "company_description"\]/,
  );
  assert.match(lib, /company_ref is required/);
  assert.match(lib, /company_ref appears more than once in this CSV/);
  assert.match(lib, /Company reference was not found in the current admin scope/);
  assert.match(lib, /MAX_DESCRIPTION_LENGTH = 20000/);
});

test("company_ref is authoritative and blank description clears only description", () => {
  const lib = source("lib/company-description-import.ts");

  assert.match(lib, /const company = byRef\.get\(key\)/);
  assert.doesNotMatch(lib, /byName/);
  assert.match(lib, /company_description: row\.desiredDescription \|\| null/);

  const saveCall = lib.match(
    /saveAdminCompanyPresentation\(row\.companyId!, \{([\s\S]*?)\}\);/,
  );
  assert.ok(saveCall);
  assert.match(saveCall[1], /company_description:/);
  assert.doesNotMatch(saveCall[1], /portal_title|welcome_heading|welcome_text|enabled|contact_|procurement_|logo|banner/);
});

test("bulk company description export is bounded and includes every referenced company", () => {
  const lib = source("lib/company-description-import.ts");

  assert.match(lib, /const CONCURRENCY = 8/);
  assert.match(lib, /getAllCompanies\(\)/);
  assert.match(lib, /getAdminCompanyPresentation\(company\.company_id\)/);
  assert.match(lib, /company\.reference, company\.name, descriptions\[index\]/);
  assert.match(lib, /csvWithBom/);
});

test("bulk import workspace exposes Company descriptions export preview and apply", () => {
  const workspace = source("components/bulk-import-workspace.tsx");
  const actions = source("app/(admin)/bulk-import/actions.ts");
  const layout = source("app/(admin)/layout.tsx");

  assert.match(workspace, /company-descriptions/);
  assert.match(workspace, /title="Company descriptions"/);
  assert.match(workspace, /bulkCompanyDescriptionsImportAction/);
  assert.match(workspace, /exports\/company-descriptions/);
  assert.match(workspace, /examples\/company-descriptions/);
  assert.match(workspace, /blank company_description explicitly clears/);

  assert.match(actions, /previewCompanyDescriptionsCsv/);
  assert.match(actions, /applyCompanyDescriptionsCsv/);
  assert.match(layout, /\/bulk-import\?view=company-descriptions/);
});

test("company description CSV routes are isolated to css_admin", () => {
  const exportRoute = source("app/api/bulk-import/exports/company-descriptions/route.ts");
  const exampleRoute = source("app/api/bulk-import/examples/company-descriptions/route.ts");

  assert.match(exportRoute, /exportBulkCompanyDescriptionsCsv/);
  assert.match(exportRoute, /bulk-company-descriptions\.csv/);
  assert.match(exampleRoute, /companyDescriptionExampleCsv/);
  assert.match(exampleRoute, /bulk-company-descriptions-example\.csv/);
});
