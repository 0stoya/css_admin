import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import loadTypeScript from "./helpers/load-typescript.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const picker = readFileSync(path.join(root, "components/company-permission-picker.tsx"), "utf8");
const staff = readFileSync(path.join(root, "app/(admin)/companies/[id]/management/page.tsx"), "utf8");
const portal = readFileSync(path.join(root, "app/(portal)/portal/page.tsx"), "utf8");
const staffActions = readFileSync(path.join(root, "app/(admin)/companies/[id]/management/actions.ts"), "utf8");
const portalActions = readFileSync(path.join(root, "app/(portal)/portal/actions.ts"), "utf8");
const { permissionIdsForForm, applyPermissionSelection } = loadTypeScript(
  root, "lib/company-permission-selection.ts",
);

const resources = [
  { resource_id: "Fluidcommerce_HyvaCompany::index", assignable: false },
  { resource_id: "Magento_Sales::all", assignable: true },
  { resource_id: "Magento_Sales::place_order", assignable: true },
  { resource_id: "Fluidcommerce_HyvaCompanyCreditOrder::all", assignable: true },
  { resource_id: "Fluidcommerce_HyvaCompanyCreditOrder::approve_reject", assignable: true },
];
const ids = (selection) => Array.from(permissionIdsForForm(resources, selection));

test("collapsed groups do not discard previously selected descendants", () => {
  const selected = new Set([
    "Fluidcommerce_HyvaCompany::index",
    "Magento_Sales::all",
    "Magento_Sales::place_order",
    "Fluidcommerce_HyvaCompanyCreditOrder::approve_reject",
  ]);
  // No filtered/expanded nodes are passed to the form serializer.
  assert.deepEqual(ids(selected), [
    "Fluidcommerce_HyvaCompany::index",
    "Magento_Sales::all",
    "Magento_Sales::place_order",
    "Fluidcommerce_HyvaCompanyCreditOrder::approve_reject",
  ]);
});

test("group selection serializes the parent and every selected child", () => {
  const original = new Set(["Fluidcommerce_HyvaCompany::index"]);
  const selected = applyPermissionSelection(
    original, ["Magento_Sales::all", "Magento_Sales::place_order"], true,
  );
  assert.deepEqual(ids(selected), [
    "Fluidcommerce_HyvaCompany::index",
    "Magento_Sales::all",
    "Magento_Sales::place_order",
  ]);
  assert.deepEqual(ids(original), ["Fluidcommerce_HyvaCompany::index"], "updates must not mutate previous React state");
});

test("clear group removes only its assignable branch, preserving protected and unrelated permissions", () => {
  const current = new Set(resources.map(({ resource_id }) => resource_id));
  const updated = applyPermissionSelection(
    current, ["Magento_Sales::all", "Magento_Sales::place_order"], false,
  );
  assert.deepEqual(ids(updated), [
    "Fluidcommerce_HyvaCompany::index",
    "Fluidcommerce_HyvaCompanyCreditOrder::all",
    "Fluidcommerce_HyvaCompanyCreditOrder::approve_reject",
  ]);
});

test("full-state submission excludes unknown/obsolete IDs and duplicates", () => {
  const selected = new Set(["Fluidcommerce_HyvaCompany::index", "nonexistent::resource"]);
  const repeated = [...resources, resources[0]];
  assert.deepEqual(
    Array.from(permissionIdsForForm(repeated, selected)),
    ["Fluidcommerce_HyvaCompany::index"],
  );
  assert.deepEqual(ids(new Set()), [], "clearing all permissions must remain possible");
});

test("only central hidden inputs submit allowedResources; displayed checkboxes never submit independently", () => {
  const visibleCheckbox = picker.slice(picker.indexOf("function PermissionCheckbox"), picker.indexOf("export function CompanyPermissionPicker"));
  const nodeRenderer = picker.slice(picker.indexOf("function renderNode"), picker.indexOf('  return (\n    <div className="permission-picker">'));
  assert.doesNotMatch(visibleCheckbox, /name="allowedResources"/);
  assert.doesNotMatch(nodeRenderer, /name="allowedResources"/);
  assert.match(picker, /permissionIdsForForm\(resources, selected\)\.map\(\(resourceId\) => \(/);
  assert.match(picker, /<input key=\{resourceId\} name="allowedResources" type="hidden" value=\{resourceId\} \/>/);
  assert.match(picker, /disabled readOnly aria-label=\{\x60\$\{node\.path\} protected\x60\}/);
  assert.match(picker, /onChange=\{\(checked\) => setResourceSelection\(node, checked\)\}/);
});

test("both Staff and Portal use the shared picker and keep their full-replacement save contract", () => {
  assert.match(staff, /<CompanyPermissionPicker resources=\{management\.resources\} selectedResourceIds=\{role\.allowed_resources\}/);
  assert.match(portal, /<CompanyPermissionPicker resources=\{administration\.resources\} selectedResourceIds=\{role\.allowed_resources\}/);
  assert.match(staffActions, /formData\.getAll\("allowedResources"\)/);
  assert.match(portalActions, /\.getAll\("allowedResources"\)/);
});
