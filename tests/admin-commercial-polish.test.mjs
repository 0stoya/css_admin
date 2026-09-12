import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (file) => readFileSync(path.join(root, file), "utf8");

test("company credit keeps read-only source-of-truth styling prominent", () => {
  const css = source("components/company-credit-workspace.module.css");
  assert.match(css, /Phase 5: make the backend-owned credit position/);
  assert.match(css, /\.positionCard[\s\S]*border-top: 3px solid var\(--css-primary\)/);
  assert.match(css, /\.readOnlyNote[\s\S]*border-left: 3px solid var\(--css-primary\)/);
  assert.match(css, /\.workflowCard[\s\S]*linear-gradient/);
});

test("pricing source remains primary while imported rows stay operationally dense", () => {
  const css = source("components/company-pricing-workspace.module.css");
  assert.match(css, /Phase 5: keep the pricing source visually dominant/);
  assert.match(css, /\.summaryHeading h2[\s\S]*font-size: clamp\(1\.45rem/);
  assert.match(css, /\.priceTable tbody tr:hover/);
  assert.match(css, /\.priceValue[\s\S]*color: var\(--css-primary\)/);
  assert.match(css, /\.readOnlyNote[\s\S]*border-left: 3px solid var\(--css-primary\)/);
});

test("finance keeps dense metrics and explicit OGL provenance", () => {
  const css = source("components/company-finance-workspace.module.css");
  assert.match(css, /Phase 5: compact finance metrics/);
  assert.match(css, /\.metricCard[\s\S]*min-height: 108px/);
  assert.match(css, /\.workspace > :global\(\.card\.stack\)/);
  assert.match(css, /\.readOnlyNote[\s\S]*border-left: 3px solid var\(--css-primary\)/);
});

test("credit-order queue emphasizes actor context and right-side action affordance", () => {
  const css = source("components/credit-orders-workspace.module.css");
  assert.match(css, /Phase 5: make actor context and backend-authorized lifecycle state/);
  assert.match(css, /\.queueRow:hover,[\s\S]*\.queueRow:focus-within/);
  assert.match(css, /\.openLink[\s\S]*background: var\(--css-primary-soft\)/);
  assert.match(css, /\.actorPanel[\s\S]*border-left: 4px solid var\(--css-primary\)/);
});

test("credit-order detail tabs and lifecycle disclosures remain in-page and clearer", () => {
  const css = source("components/credit-orders-workspace.module.css");
  assert.match(css, /\.tabs[\s\S]*position: sticky/);
  assert.match(css, /\.actionDisclosure summary:hover/);
  assert.match(css, /\.actionDisclosure\[open\][\s\S]*border-color: #b7c8d7/);
  assert.match(css, /\.warning[\s\S]*border-left: 4px solid var\(--css-warning\)/);
});

test("Phase 4 is recorded as deployed and Phase 5 is active", () => {
  const roadmap = source("docs/ADMIN_UI_POLISH_ROADMAP.md");
  assert.match(roadmap, /## ✅ Phase 4 — Policy\/configuration interactions/);
  assert.match(roadmap, /PR #75 merged, deployed and visually accepted/);
  assert.match(roadmap, /PR #76 followed with the deployed Payment save-button contrast fix/);
  assert.match(roadmap, /## 🟡 Phase 5 — Commercial and operational surfaces/);
});

test("Phase 5 preserves backend and actor authority boundaries", () => {
  const roadmap = source("docs/ADMIN_UI_POLISH_ROADMAP.md");
  assert.match(roadmap, /Company Credit, Pricing and Finance remain read-only/);
  assert.match(roadmap, /actions exclusively from Fluid for the selected actor/);
  assert.match(roadmap, /preserve the customer-owned `approved_pending_payment` boundary/);
  assert.match(roadmap, /no GraphQL, server-action, ACL or backend changes/);
});
