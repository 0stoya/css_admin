import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const source = (relative) => readFileSync(path.join(root, relative), "utf8");

test("payment policy keeps the existing form contract while adding Lucide interaction affordances", () => {
  const text = source("components/payment-configuration-workspace.tsx");
  assert.match(text, /name="mode"/);
  assert.match(text, /name="allowedMethods"/);
  assert.match(text, /saveCompanyPaymentConfigurationAction/);
  assert.match(text, /useFormStatus/);
  assert.match(text, /Globe2/);
  assert.match(text, /CircleCheckBig/);
  assert.match(text, /SlidersHorizontal/);
  assert.match(text, /Save/);
  assert.match(text, /Search/);
  assert.match(text, /CheckCheck/);
  assert.match(text, /Eraser/);
  assert.match(text, /aria-live="polite"/);
});

test("payment save state prevents repeat submit and specific mode still requires a selection", () => {
  const text = source("components/payment-configuration-workspace.tsx");
  assert.match(text, /disabled=\{disabled \|\| pending\}/);
  assert.match(text, /const cannotSave = mode === "specific" && selected\.size === 0/);
  assert.match(text, /pending \? "Saving payment policy…" : "Save payment policy"/);
});

test("catalogue polish keeps large editors in-page and makes restriction/reset actions scan consistently", () => {
  const css = source("app/admin-policy-interactions.css");
  assert.match(css, /\.admin-shell \.catalogue-tab::before/);
  assert.match(css, /\.catalogue-status-card::before/);
  assert.match(css, /\.catalogue-control-editor > summary > span:first-child::before/);
  assert.match(css, /\.catalogue-reset-action button::before/);
  assert.match(css, /\.catalogue-role-search input\[type="search"\]/);
  assert.match(css, /\.catalogue-form-actions/);
  assert.doesNotMatch(css, /dialog|position:\s*fixed/);
});

test("company settings tabs and summaries gain policy/source icons while danger remains isolated", () => {
  const css = source("components/company-settings-workspace.module.css");
  assert.match(css, /\.tab::before/);
  assert.match(css, /\.tab:nth-child\(3\)\.tabActive/);
  assert.match(css, /var\(--css-danger-soft\)/);
  assert.match(css, /\.summaryItem::before/);
  assert.match(css, /\.ownershipNote::before/);
  assert.match(css, /\.parentCard::before/);
  assert.match(css, /\.saveBar \{[\s\S]*position: sticky/);
  assert.match(css, /\.confirmBox \{[\s\S]*border: 1px dashed/);
});

test("policy polish is loaded after the earlier admin layers and stays admin-scoped", () => {
  const layout = source("app/layout.tsx");
  assert.match(layout, /admin-interaction-polish\.css";\nimport "\.\/admin-policy-interactions\.css";/);
  const css = source("app/admin-policy-interactions.css");
  const selectors = css.match(/[^{}]+\{/g) ?? [];
  const relevant = selectors.map((value) => value.trim()).filter((value) => value.startsWith(".admin-shell"));
  assert.ok(relevant.length > 10);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.doesNotMatch(css, /portal-/);
});

test("roadmap records deployed phase 3 and policy/configuration as active phase 4", () => {
  const roadmap = source("docs/ADMIN_UI_POLISH_ROADMAP.md");
  assert.match(roadmap, /## ✅ Phase 3/);
  assert.match(roadmap, /PR #74 merged, deployed and visually accepted/);
  assert.match(roadmap, /## 🟡 Phase 4/);
  assert.match(roadmap, /large catalogue pickers and long company-local configuration forms stay in the page flow/);
  assert.match(roadmap, /pending save feedback/);
});
