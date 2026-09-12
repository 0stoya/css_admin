import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Admin shell exposes a keyboard skip link and focusable main target", () => {
  const layout = source("app/(admin)/layout.tsx");
  assert.match(layout, /className="admin-skip-link"/);
  assert.match(layout, /href="#admin-main-content"/);
  assert.match(layout, /<main className="content" id="admin-main-content" tabIndex=\{-1\}>/);
});

test("responsive Admin navigation keeps local company and tool links reachable", () => {
  const css = source("app/sidebar.css");
  assert.match(css, /@media \(max-width: 1100px\)/);
  assert.match(css, /\.app-sidebar:not\(:has\(\.sidebar-subnav\)\)/);
  assert.match(css, /\.sidebar-subnav,[\s\S]*\.sidebar-company-subnav[\s\S]*display: flex/);
  assert.match(css, /\.sidebar-sublink-active[\s\S]*box-shadow: inset 0 -3px var\(--css-secondary\)/);
});

test("Phase 7 CSS handles focus, overflow, reduced motion and forced colours", () => {
  const css = source("app/admin-accessibility-phase7.css");
  assert.match(css, /\.admin-skip-link:focus-visible/);
  assert.match(css, /\.admin-shell \.table-wrap[\s\S]*overflow: auto/);
  assert.match(css, /overflow-wrap: anywhere/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /forced-colors: active/);
});

test("company directory exposes structure state to assistive technology", () => {
  const page = source("components/company-directory.tsx");
  assert.match(page, /const structureId = `company-tree-\$\{company\.company_id\}`/);
  assert.match(page, /aria-label=\{hasChildren \?/);
  assert.match(page, /aria-expanded=\{expanded\}/);
  assert.match(page, /aria-controls=\{structureId\}/);
});

test("Admin media inputs have useful accessible names and deferred decoding", () => {
  const reps = source("app/(admin)/ogl/rep-profiles/page.tsx");
  assert.match(reps, /aria-label=\{`Choose profile photo for \$\{name\}`\}/);
  assert.match(reps, /aria-label=\{`Upload photo for \$\{name\}`\}/);
  assert.match(reps, /loading="lazy" decoding="async"/);

  const personalisation = source("app/(admin)/companies/[id]/personalisation/page.tsx");
  assert.match(personalisation, /aria-label=\{`Choose \$\{label\.toLowerCase\(\)\} image`\}/);
  assert.match(personalisation, /Remove \{kind\.toLowerCase\(\)\}/);
  assert.match(personalisation, /loading="lazy" decoding="async"/);
});

test("Phase 7 visual layer is loaded after the previous Admin polish", () => {
  const layout = source("app/layout.tsx");
  const previous = layout.indexOf('import "./admin-final-surface-polish.css"');
  const phase7 = layout.indexOf('import "./admin-accessibility-phase7.css"');
  assert.ok(previous >= 0);
  assert.ok(phase7 > previous);
});

test("roadmap records Phase 6 completion and Phase 7 as active", () => {
  const roadmap = source("docs/ADMIN_UI_POLISH_ROADMAP.md");
  assert.match(roadmap, /✅ Phase 6/);
  assert.match(roadmap, /PR #78 merged and deployed/);
  assert.match(roadmap, /PR #80/);
  assert.match(roadmap, /🟡 Phase 7/);
  assert.match(roadmap, /Skip to main content/);
  assert.match(roadmap, /200% browser zoom/);
});
