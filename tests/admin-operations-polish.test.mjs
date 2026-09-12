import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("OGL polish keeps registry, mappings and live preview contracts in-page", () => {
  const page = source("app/(admin)/ogl/page.tsx");
  assert.match(page, /Companies/);
  assert.match(page, /Rep mappings/);
  assert.match(page, /Live OGL preview/);
  assert.match(page, /fetchOglCompaniesAction/);
  assert.match(page, /importAllEnabledOglCompaniesAction/);
  assert.match(page, /setOglCompanySyncAction/);
  assert.match(page, /setOglCompanyRepOverrideAction/);
});

test("OGL visual layer strengthens sticky tabs, preview and row hierarchy", () => {
  const css = source("components/ogl-workspace.module.css");
  assert.match(css, /position: sticky/);
  assert.match(css, /\.previewPanel[\s\S]*border-left: 4px solid var\(--css-primary\)/);
  assert.match(css, /\.tableWrap tbody tr:hover/);
  assert.match(css, /\.rowActions/);
  assert.match(css, /mask:/);
});

test("representative profile presentation stays separate from mapping ownership", () => {
  const page = source("app/(admin)/ogl/rep-profiles/page.tsx");
  assert.match(page, /presentation-only/);
  assert.match(page, /Manage rep mappings/);
  assert.match(page, /saveOglRepProfileAction/);
  assert.match(page, /uploadOglRepPhotoAction/);
  assert.match(page, /clearOglRepPhotoAction/);
  assert.doesNotMatch(page, /saveOglRepMappingAction/);
});

test("rep-profile CSS gives save and media actions a consistent operational hierarchy", () => {
  const css = source("components/rep-profile-workspace.module.css");
  assert.match(css, /\.profileForm/);
  assert.match(css, /\.mediaActions/);
  assert.match(css, /button::before/);
  assert.match(css, /\.toggleRow input:focus-visible/);
});

test("bulk and company CSV flows still require preview before apply", () => {
  for (const path of ["components/bulk-import-workspace.tsx", "components/flat-company-imports.tsx"]) {
    const text = source(path);
    assert.match(text, /name="intent" type="hidden" value="preview"/);
    assert.match(text, /name="intent" type="hidden" value="apply"/);
    assert.match(text, /state\.phase === "preview"/);
    assert.match(text, /errors > 0 \|\| actionable === 0/);
    assert.match(text, /Choose CSV/);
    assert.match(text, /Preview/);
    assert.match(text, /Apply/);
  }
});

test("import polish makes Choose Preview Apply visually dominant without changing routing", () => {
  const css = source("components/company-import-export-workspace.module.css");
  assert.match(css, /\.stepActive/);
  assert.match(css, /\.stepDone/);
  assert.match(css, /\.applyArea[\s\S]*border-left: 4px solid var\(--css-primary\)/);
  assert.match(css, /\.downloads a::before/);
  assert.match(css, /\.uploadGrid > button::before/);
  assert.match(css, /\.applyArea :global\(\.button-row\) > button::before/);

  const companyPage = source("app/(admin)/companies/[id]/import-export/page.tsx");
  assert.match(companyPage, /company_ref/);
  assert.match(companyPage, /CompanyFlatImportPanels/);
});

test("roadmap records Phase 5 acceptance and Phase 6 as active", () => {
  const roadmap = source("docs/ADMIN_UI_POLISH_ROADMAP.md");
  assert.match(roadmap, /Phase 5[\s\S]*PR #77 merged, deployed and visually accepted/);
  assert.match(roadmap, /🟡 Phase 6/);
  assert.match(roadmap, /Choose → Preview → Apply/);
});
