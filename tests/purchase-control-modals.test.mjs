import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
function load(path, mocks = {}) {
  const result = ts.transpileModule(source(path), {
    fileName: path,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    reportDiagnostics: true,
  });
  assert.equal(result.diagnostics?.length ?? 0, 0, `${path} syntax diagnostics`);
  const module = { exports: {} };
  new Function("require", "module", "exports", result.outputText)(
    (id) => Object.hasOwn(mocks, id) ? mocks[id] : require(id), module, module.exports,
  );
  return module.exports;
}

const helpers = load("lib/purchase-control-forms.ts");
function actionHarness({ failure, returnedId = 6 } = {}) {
  const calls = [];
  const invalidations = [];
  const navigation = new Error("NEXT_REDIRECT");
  const action = load("app/(admin)/companies/[id]/purchase-controls/edit-actions.ts", {
    "next/cache": { revalidatePath: (path) => invalidations.push(path) },
    "next/navigation": { unstable_rethrow: (error) => { if (error === navigation) throw error; } },
    "@/lib/graphql/client": { graphQLErrorMessage: (error) => { if (error.message === "expired") throw navigation; return error.message; } },
    "@/lib/graphql/purchase-controls": { savePurchaseControlTemplate: async (...args) => {
      calls.push(args);
      if (failure) throw failure;
      return { cssAdminSavePurchaseControlTemplate: { template_id: returnedId, name: "PPE" } };
    } },
    "@/lib/purchase-control-forms": helpers,
  }).editPurchaseControlTemplateAction;
  return { action, calls, invalidations, navigation };
}
function form(values = {}) {
  const data = new FormData();
  Object.entries({ companyId: "12", templateId: "6", name: " PPE ", rules: "A1117H | 10 | 365 | 2026-09-01", ...values }).forEach(([key, value]) => data.set(key, value));
  return data;
}

test("edit saves only a template definition and revalidates the selected company", async () => {
  const h = actionHarness();
  assert.deepEqual(await h.action({ status: "idle" }, form()), { status: "saved", templateId: 6 });
  assert.deepEqual(h.calls, [[12, { template_id: 6, name: "PPE", rules: [{ sku: "A1117H", quantity_limit: 10, duration_days: 365, start_date: "2026-09-01" }] }]]);
  assert.deepEqual(h.invalidations, ["/companies/12/purchase-controls"]);
});
for (const [label, values] of [
  ["missing company", { companyId: "" }],
  ["invalid company", { companyId: "../1" }],
  ["missing template", { templateId: "" }],
  ["out-of-range template", { templateId: "2147483648" }],
  ["empty name", { name: " " }],
  ["invalid calendar date", { rules: "A | 10 | 365 | 2026-02-30" }],
  ["duplicate SKU does not enable stacked limits", { rules: "A | 10 | 365 | 2026-09-01\na | 2 | 30 | 2026-09-01" }],
  ["zero quantity", { rules: "A | 0 | 365 | 2026-09-01" }],
  ["fractional duration", { rules: "A | 10 | 30.5 | 2026-09-01" }],
]) test(`${label} returns inline feedback without any write`, async () => {
  const h = actionHarness();
  const result = await h.action({ status: "saved", templateId: 999 }, form(values));
  assert.equal(result.status, "error");
  assert.ok(result.message);
  assert.equal(h.calls.length, 0);
  assert.equal(h.invalidations.length, 0);
});
test("Magento permission/scope denial is returned, not swallowed or retried", async () => {
  const h = actionHarness({ failure: new Error("This template does not belong to the permitted company.") });
  assert.match((await h.action({ status: "idle" }, form())).message, /permitted company/);
  assert.equal(h.calls.length, 1);
  assert.equal(h.invalidations.length, 0);
});
test("expired-session navigation propagates out of the action", async () => {
  const h = actionHarness({ failure: new Error("expired") });
  await assert.rejects(h.action({ status: "idle" }, form()), (error) => error === h.navigation);
});
test("unexpected response ID is not reported as a successful save", async () => {
  const h = actionHarness({ returnedId: 9 });
  assert.equal((await h.action({ status: "idle" }, form())).status, "error");
  assert.equal(h.invalidations.length, 0);
});

const jsx = (type, props) => ({ type, props });
const styles = new Proxy({}, { get: (_, name) => String(name) });
function dialogHarness(overrides = {}) {
  let effect;
  let closes = 0;
  const mod = load("components/purchase-control-dialog.tsx", {
    "react": { useId: (() => { let n = 0; return () => `id-${++n}`; })(), useRef: (value) => ({ current: value }), useEffect: (work) => { effect = work; } },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "lucide-react": { X: "X" },
    "./purchase-control-modals.module.css": { default: styles },
  });
  const tree = mod.PurchaseControlDialog({ open: true, onClose: () => closes++, title: "Help", description: "Guide", children: "content", ...overrides });
  const dialog = { open: false, shown: 0, closed: 0,
    getBoundingClientRect: () => ({ left: 100, right: 700, top: 100, bottom: 600 }),
    showModal() { this.open = true; this.shown++; },
    close() { this.open = false; this.closed++; },
    querySelector: (selector) => ({ focus: () => { dialog.focused = selector; } }),
  };
  tree.props.ref.current = dialog;
  const pointer = (x, y, target = dialog) => ({ target, clientX: x, clientY: y });
  return { tree, dialog, runEffect: () => effect(), count: () => closes, pointer };
}
test("dialog uses native showModal, initial heading focus and labelled description", () => {
  const h = dialogHarness();
  const originalDocument = globalThis.document, originalHTMLElement = globalThis.HTMLElement;
  class Element { isConnected = true; focused = false; focus() { this.focused = true; } }
  const trigger = new Element();
  globalThis.HTMLElement = Element;
  globalThis.document = { activeElement: trigger, body: { style: { overflow: "auto" } } };
  try {
    const cleanup = h.runEffect();
    assert.equal(h.dialog.shown, 1);
    assert.equal(h.dialog.focused, "h2");
    assert.equal(document.body.style.overflow, "hidden");
    assert.ok(h.tree.props["aria-labelledby"]);
    assert.ok(h.tree.props["aria-describedby"]);
    cleanup();
    assert.equal(h.dialog.closed, 1);
    assert.equal(document.body.style.overflow, "auto");
    assert.equal(trigger.focused, true);
  } finally { globalThis.document = originalDocument; globalThis.HTMLElement = originalHTMLElement; }
});
test("Escape requests closing when not saving", () => {
  const h = dialogHarness(); let prevented = false;
  h.tree.props.onCancel({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true); assert.equal(h.count(), 1);
});
test("Escape cannot dismiss a pending save", () => {
  const h = dialogHarness({ busy: true });
  h.tree.props.onCancel({ preventDefault() {} });
  assert.equal(h.count(), 0); assert.equal(h.tree.props["aria-busy"], true);
});
test("a click that starts and ends on the backdrop closes help", () => {
  const h = dialogHarness();
  h.tree.props.onPointerDown(h.pointer(20, 20)); h.tree.props.onClick(h.pointer(20, 20));
  assert.equal(h.count(), 1);
});
test("clicking dialog padding or dragging out of content does not dismiss it", () => {
  const h = dialogHarness();
  h.tree.props.onPointerDown(h.pointer(105, 105)); h.tree.props.onClick(h.pointer(105, 105));
  h.tree.props.onPointerDown(h.pointer(300, 300, {})); h.tree.props.onClick(h.pointer(20, 20));
  assert.equal(h.count(), 0);
});
test("edit modal refuses backdrop dismissal", () => {
  const h = dialogHarness({ closeOnBackdrop: false });
  h.tree.props.onPointerDown(h.pointer(20, 20)); h.tree.props.onClick(h.pointer(20, 20));
  assert.equal(h.count(), 0);
});
test("closed help does not lock the page or call showModal", () => {
  const h = dialogHarness({ open: false });
  assert.equal(h.runEffect(), undefined); assert.equal(h.dialog.shown, 0);
});
test("editor keeps a controlled name and retained rule editor on error", () => {
  const text = source("components/purchase-template-edit-modal.tsx");
  assert.match(text, /value=\{name\}/);
  assert.match(text, /useActionState/);
  assert.match(text, /state.status === "error"/);
  assert.match(text, /errorRef.current\?\.focus\(\)/);
  assert.match(text, /fieldset[^>]+disabled=\{pending\}/);
  assert.match(text, /initialRules=\{template.rules\}/);
  assert.doesNotMatch(text, /window\.location|form\.reset\(/);
});
test("staff heading contains the info trigger and the old editor accordion is removed", () => {
  const page = source("app/(admin)/companies/[id]/purchase-controls/page.tsx");
  assert.match(page, /<h2>Purchase-control templates<\/h2>\s*<PurchaseControlGuidance iconOnly/);
  assert.match(page, /Each template is a reusable set of SKU quantity and time-window rules\./);
  assert.match(page, /saveAction=\{editPurchaseControlTemplateAction\}/);
  assert.doesNotMatch(page, /<details className="purchase-editor-panel"/);
  assert.doesNotMatch(source("app/(admin)/companies/[id]/purchase-controls/layout.tsx"), /PurchaseControlGuidance/);
});
test("help keeps history/reset cautions and explicitly says stacked limits are unsupported", () => {
  const text = source("components/purchase-control-guidance.tsx");
  assert.match(text, /not supported yet/); assert.match(text, /every role assigned/);
  assert.match(text, /without changing their start dates|without changing start dates/);
  assert.match(text, /legacy purchases do not automatically replenish/);
  assert.match(text, /PurchaseControlHelp iconOnly=\{iconOnly\}/);
});
test("new edit action has no apply/reset mutation or template-creation fallback", () => {
  const text = source("app/(admin)/companies/[id]/purchase-controls/edit-actions.ts");
  assert.doesNotMatch(text, /applyPurchaseControlTemplate|resetPurchaseControlCounters|optionalId/);
  assert.match(text, /requiredId\(formData, "templateId"\)/);
});
test("Lucide dependency matches the installed Admin version", () => {
  assert.equal(JSON.parse(source("package.json")).dependencies["lucide-react"], "^1.45.0");
});
