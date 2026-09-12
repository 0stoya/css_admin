import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import load from "./helpers/load-typescript.mjs";
const root = fileURLToPath(new URL("..", import.meta.url));
const forms = load(root, "lib/purchase-control-forms.ts");
const form = (values) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, String(value));
  return data;
};

for (const raw of ["PPE | 4 | 365 | 2026-09-12", " PPE | 4 | 365 | 2024-02-29 \r\n"]) {
  test(`parse valid rule ${raw.trim()}`, () => {
    const [rule] = forms.parsePurchaseRules(raw);
    assert.equal(rule.quantity_limit, 4);
    assert.equal(rule.duration_days, 365);
    assert.equal(rule.sku, "PPE");
  });
}
for (const raw of [
  "PPE | 0 | 365 | 2026-09-12", "PPE | 1.5 | 365 | 2026-09-12",
  "PPE | 4 | -1 | 2026-09-12", "PPE | 4 | 365 | 2026-02-29",
  "PPE | 4 | 365 | 2026-04-31", "PPE | 4 | 365 | 2026-9-12",
  "PPE | 2147483648 | 365 | 2026-09-12", "PPE | 4 | 2147483648 | 2026-09-12",
  "PPE | Infinity | 365 | 2026-09-12", "PPE | 4 | 365 | 2026-09-12 | extra",
  "PPE | 4 | 365 | 2026-09-12\nppe | 2 | 30 | 2026-09-12",
]) {
  test(`reject invalid rule ${raw}`, () => assert.throws(() => forms.parsePurchaseRules(raw)));
}
test("an empty definition remains a supported explicit template edit", () => assert.equal(forms.parsePurchaseRules(" \n").length, 0));
test("checkbox false is not treated as apply-to-users", () => {
  assert.equal(forms.checkboxChecked(form({ applyToUsers: "false" }), "applyToUsers"), false);
  assert.equal(forms.checkboxChecked(form({ applyToUsers: "on" }), "applyToUsers"), true);
});
test("zero affected users is not advertised as a successful reset", () => {
  assert.match(forms.affectedUsersNotice("reset", 0), /No eligible buyers/);
  assert.match(forms.affectedUsersNotice("reset", 2), /2 eligible buyers/);
  assert.match(forms.assignmentNotice(7, false, 0), /not changed/);
  assert.match(forms.assignmentNotice(null, false, 0), /not removed/);
});

class Navigation extends Error {
  constructor(location) { super(location); this.location = location; }
}
function harness(portal, response = {}, failure = null) {
  const calls = [];
  const api = new Proxy({}, { get: (_, name) => async (...args) => {
    calls.push({ name, args });
    if (failure) throw failure;
    return response;
  } });
  const actionPath = portal
    ? "app/(portal)/portal/purchase-controls/actions.ts"
    : "app/(admin)/companies/[id]/purchase-controls/actions.ts";
  const exports = load(root, actionPath, {
    "next/cache": { revalidatePath: () => {} },
    "next/navigation": {
      redirect: (location) => { throw new Navigation(location); },
      unstable_rethrow: (error) => { if (error instanceof Navigation) throw error; },
    },
    "@/lib/graphql/client": { graphQLErrorMessage: (error) => {
      if (error.expired) throw new Navigation("/api/auth/session-expired");
      return error.message;
    } },
    "@/lib/purchase-control-forms": forms,
    [portal ? "@/lib/graphql/company-portal-purchase-controls" : "@/lib/graphql/purchase-controls"]: api,
  });
  return { calls, exports };
}
async function redirectFrom(work) {
  try { await work(); assert.fail("expected navigation"); }
  catch (error) { assert.ok(error instanceof Navigation, String(error)); return new URL(error.location, "https://app.invalid"); }
}
for (const portal of [false, true]) {
  const prefix = portal ? "company" : "admin";
  const names = portal ? {
    save: "savePortalPurchaseControlTemplateAction", assign: "assignPortalPurchaseControlTemplateAction",
    apply: "applyPortalPurchaseControlTemplateAction", reset: "resetPortalPurchaseControlCountersAction",
  } : {
    save: "savePurchaseControlTemplateAction", assign: "assignPurchaseControlTemplateAction",
    apply: "applyPurchaseControlTemplateAction", reset: "resetPurchaseControlCountersAction",
  };
  test(`${prefix}: invalid dates redirect as feedback without calling Magento`, async () => {
    const h = harness(portal);
    const url = await redirectFrom(() => h.exports[names.save](form({ companyId: 3, name: "PPE", rules: "PPE | 4 | 30 | 2026-02-30" })));
    assert.match(url.searchParams.get("error"), /real date/);
    assert.equal(h.calls.length, 0);
  });
  test(`${prefix}: save does not apply or reset`, async () => {
    const h = harness(portal);
    const url = await redirectFrom(() => h.exports[names.save](form({ companyId: 3, name: "PPE", rules: "PPE | 4 | 30 | 2026-09-12" })));
    assert.match(url.searchParams.get("notice"), /not changed/);
    assert.equal(h.calls.length, 1);
    assert.match(h.calls[0].name, /^save/);
  });
  for (const action of ["apply", "reset"]) {
    test(`${prefix}: ${action} needs its existing explicit confirmation`, async () => {
      const h = harness(portal);
      const url = await redirectFrom(() => h.exports[names[action]](form({ companyId: 3, templateId: 7 })));
      assert.match(url.searchParams.get("error"), /Confirm/);
      assert.equal(h.calls.length, 0);
    });
  }
  test(`${prefix}: the mutation's zero count is surfaced`, async () => {
    const field = portal ? "cssApplyCompanyPurchaseControlTemplate" : "cssAdminApplyPurchaseControlTemplate";
    const h = harness(portal, { [field]: { affected_users: 0 } });
    const url = await redirectFrom(() => h.exports[names.apply](form({ companyId: 3, templateId: 7, confirmApply: "yes" })));
    assert.match(url.searchParams.get("notice"), /No eligible buyers/);
    assert.equal(h.calls.length, 1);
  });
  test(`${prefix}: assignment does not silently apply on a false checkbox`, async () => {
    const field = portal ? "cssAssignCompanyPurchaseControlTemplate" : "cssAdminAssignPurchaseControlTemplate";
    const h = harness(portal, { [field]: { applied_users: 0 } });
    const url = await redirectFrom(() => h.exports[names.assign](form({ companyId: 3, roleId: 9, templateId: 7, applyToUsers: "false" })));
    assert.equal(h.calls[0].args.at(-1), false);
    assert.match(url.searchParams.get("notice"), /not changed/);
    if (portal) assert.equal(url.searchParams.get("section"), "assignments");
  });
  test(`${prefix}: cannot apply while unassigning`, async () => {
    const h = harness(portal);
    const url = await redirectFrom(() => h.exports[names.assign](form({ companyId: 3, roleId: 9, templateId: "", applyToUsers: "on" })));
    assert.match(url.searchParams.get("error"), /Select a template/);
    assert.equal(h.calls.length, 0);
  });
  test(`${prefix}: backend permission denial remains an error`, async () => {
    const h = harness(portal, {}, new Error("Not authorised for this company"));
    const url = await redirectFrom(() => h.exports[names.apply](form({ companyId: 3, templateId: 7, confirmApply: "yes" })));
    assert.match(url.searchParams.get("error"), /Not authorised/);
    assert.equal(url.searchParams.has("notice"), false);
  });
  test(`${prefix}: session expiry navigation is preserved`, async () => {
    const h = harness(portal, {}, { message: "expired", expired: true });
    const url = await redirectFrom(() => h.exports[names.apply](form({ companyId: 3, templateId: 7, confirmApply: "yes" })));
    assert.equal(url.pathname, "/api/auth/session-expired");
  });
}
