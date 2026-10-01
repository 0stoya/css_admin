import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("portal migration tracker stays inside the staff Admin boundary", () => {
  const adminLayout = source("app/(admin)/layout.tsx");
  const portalLayout = source("app/(portal)/layout.tsx");
  const actions = source("app/(admin)/migrations/actions.ts");

  assert.match(adminLayout, /href: "\/migrations", label: "Migrations"/);
  assert.match(adminLayout, /href: "\/help", label: "Help"/);
  assert.match(adminLayout, /getAdminToken/);
  assert.doesNotMatch(portalLayout, /\/migrations/);
  assert.doesNotMatch(portalLayout, /\/help/);

  assert.match(actions, /getAdminToken/);
  assert.match(actions, /redirect\("\/login"\)/);
  assert.match(actions, /createPortalMigrationAction/);
  assert.match(actions, /updatePortalMigrationTaskAction/);
});

test("portal migration storage has migrations, checklist tasks and append-only events", () => {
  const sql = source("deploy/postgres/003_portal_migrations.sql");

  assert.match(sql, /CREATE TABLE IF NOT EXISTS css_admin\.portal_migration \(/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS css_admin\.portal_migration_task \(/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS css_admin\.portal_migration_event \(/);
  assert.match(sql, /ON DELETE CASCADE/);
  assert.match(sql, /'not_applicable'/);
  assert.match(sql, /portal_migration_root_company_ref_unique/);
});

test("new migrations receive the standard portal checklist and real readiness states", () => {
  const store = source("lib/portal-migrations.ts");

  for (const key of [
    "company_structure",
    "company_products",
    "roles_permissions",
    "company_users",
    "role_products",
    "purchase_controls",
    "company_descriptions",
    "personalisation",
    "import_preview",
    "import_applied",
    "internal_qa",
    "customer_qa",
    "go_live",
  ]) {
    assert.match(store, new RegExp(`key: "${key}"`));
  }

  assert.match(store, /status IN \('complete', 'not_applicable'\)/);
  assert.match(store, /blocked_count/);
  assert.match(store, /ready: taskCount > 0 && doneCount === taskCount && blockedCount === 0/);
  assert.match(store, /Open the relevant Admin tool|toolHref/);
});

test("migration pages expose queue, filters, checklist, blockers and activity", () => {
  const queue = source("app/(admin)/migrations/page.tsx");
  const detail = source("app/(admin)/migrations/[id]/page.tsx");

  assert.match(queue, /Migration queue/);
  assert.match(queue, /Blocked only/);
  assert.match(queue, /Target go-live/);
  assert.match(queue, /Create portal migration/);

  assert.match(detail, /Portal readiness/);
  assert.match(detail, /Not applicable/);
  assert.match(detail, /Recent activity/);
  assert.match(detail, /Open the relevant Admin tool/);
  assert.match(detail, /updatePortalMigrationTaskAction/);
});

test("staff help leads with a concise portal-creation flow and keeps deeper FAQ optional", () => {
  const page = source("app/(admin)/help/page.tsx");
  const guide = source("lib/portal-creation-guide.ts");
  const library = source("lib/admin-help-library.ts");
  const contextual = source("lib/admin-context-help.ts");

  assert.match(page, /Portal creation — quick guide/);
  assert.match(page, /You should receive/);
  assert.match(page, /More help \/ common questions/);
  assert.match(guide, /Current company hierarchy/);
  assert.match(guide, /Proposed SKU list/);
  assert.match(guide, /Build the company hierarchy/);
  assert.match(guide, /Create roles, then users/);
  assert.match(guide, /Add restrictions only when needed/);
  assert.match(guide, /Add content, preview, then QA/);
  assert.match(guide, /\/api\/bulk-import\/examples\/company-structure/);
  assert.match(guide, /\/api\/bulk-import\/examples\/company-products/);
  assert.match(guide, /\/api\/bulk-import\/examples\/roles/);
  assert.match(guide, /\/api\/bulk-import\/examples\/users/);
  assert.match(guide, /\/api\/bulk-import\/examples\/role-products/);
  assert.match(guide, /\/api\/bulk-import\/examples\/purchase-controls/);
  assert.match(library, /What is the difference between company products and role products\?/);
  assert.match(contextual, /About Portal migrations/);
  assert.match(contextual, /Staff only/);
});

test("bulk import navigation exposes every migration-linked dataset", () => {
  const layout = source("app/(admin)/layout.tsx");

  assert.match(layout, /view=company-products/);
  assert.match(layout, /view=role-products/);
  assert.match(layout, /view=purchase-controls/);
  assert.match(layout, /view=company-descriptions/);
});
