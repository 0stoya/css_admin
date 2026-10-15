import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (file) => readFileSync(path.join(root, file), "utf8");

const queue = source("app/(admin)/companies/[id]/credit-orders/page.tsx");
const detail = source("app/(admin)/companies/[id]/credit-orders/[number]/page.tsx");
const css = source("components/credit-orders-workspace.module.css");
const credit = source("lib/graphql/admin-credit-orders.ts");

test("the queue distinguishes Fluid credit-order numbers from Magento sales-order numbers", () => {
  assert.match(queue, /<span>Credit order<\/span><span>Status<\/span>/);
  assert.match(queue, /placeholder="Credit order number"/);
  assert.match(queue, /Credit order number<\/span>/);
  assert.match(queue, /Magento sales order \{order\.order_number\}/);
  assert.match(queue, /No Magento sales order yet/);
  assert.match(queue, /PO \$\{order\.purchase_order_number\}/);
  assert.doesNotMatch(queue, /Credit order #\{order\.credit_order_id\}/);
});

test("the real Magento sales-order number remains distinct from the credit-order route key", () => {
  assert.match(credit, /credit_order_id: number/);
  assert.match(credit, /number: string/);
  assert.match(credit, /order_id: number \| null/);
  assert.match(credit, /order_number: string \| null/);
  assert.match(queue, /encodeURIComponent\(order\.number\)/);
  assert.match(queue, /Open credit order →/);
  assert.match(detail, /getAdminCreditOrder\(companyId, number, actor\)/);
  assert.match(detail, /load\(companyId, route\.number, actor\)/);
  assert.doesNotMatch(queue, /encodeURIComponent\(order\.order_number\)/);
});

test("detail labels the technical credit record and Magento sales order separately", () => {
  assert.match(detail, /Internal credit record ID \{order\.credit_order_id\}/);
  assert.match(detail, /<h1>Credit order \{order\.number\}<\/h1>/);
  assert.match(detail, /<span>Magento sales order<\/span>/);
  assert.match(detail, /<strong>\{order\.order_number\}<\/strong>/);
  assert.match(detail, /<span className=\{styles\.heroLabel\}>Magento sales order<\/span>/);
  assert.match(detail, /order\.order_number \|\| "Not placed"/);
  assert.doesNotMatch(detail, /Credit order #\{order\.credit_order_id\}/);
});

test("tablet layout retains Magento reference instead of hiding its column", () => {
  assert.match(css, /Keep the Magento sales-order reference visible on tablet layouts/);
  assert.match(css, /\.queueRow > :nth-child\(3\)/);
  assert.match(css, /\.queueRow > :nth-child\(6\)/);
  assert.doesNotMatch(css, /\.queueRow > :nth-child\(5\)[\s\S]{0,80}display: none;/);
  assert.match(css, /\.magentoReference/);
  assert.match(css, /\.salesOrderReference/);
});
