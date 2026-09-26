import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import load from "./helpers/load-typescript.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

class Navigation extends Error {
  constructor(location) {
    super(location);
    this.location = location;
  }
}

const redirect = (location) => { throw new Navigation(location); };
const form = (values) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, String(value));
  return data;
};

function managementActions(overrides = {}) {
  const defaults = {
    addCompanyUser: async () => {},
    deleteCompanyRole: async () => {},
    removeCompanyUser: async () => {},
    saveCompanyRole: async () => {},
    updateCompanyUser: async () => {},
  };
  const invalidations = [];
  const actions = load(root, "app/(admin)/companies/[id]/management/actions.ts", {
    "next/cache": { revalidatePath: (value) => invalidations.push(value) },
    "next/navigation": { redirect },
    "@/lib/graphql/client": { graphQLErrorMessage: (error) => error.message },
    "@/lib/graphql/company-management": { ...defaults, ...overrides },
  });
  return { actions, invalidations };
}

function employeeActions(overrides = {}) {
  const defaults = {
    applyCompanyEmployeePurchaseControl: async () => {},
    assignCompanyEmployeePurchaseControl: async () => {},
    createCompanyEmployee: async () => {},
    deactivateCompanyEmployee: async () => {},
    importCompanyEmployees: async () => ({ failed: 0, errors: [] }),
    resetCompanyEmployeePurchaseControl: async () => {},
    saveCompanyEmployeeConfiguration: async () => {},
    updateCompanyEmployee: async () => {},
  };
  const invalidations = [];
  const actions = load(root, "app/(admin)/companies/[id]/employees/actions.ts", {
    "next/cache": { revalidatePath: (value) => invalidations.push(value) },
    "next/navigation": { redirect },
    "@/lib/graphql/client": { graphQLErrorMessage: (error) => error.message },
    "@/lib/company-employees-csv": { parseEmployeeCsv: () => [], resolveEmployeeCsvManagers: () => [] },
    "@/lib/graphql/company-management": { getCompanyManagement: async () => ({ users: [] }) },
    "@/lib/graphql/company-employees": { ...defaults, ...overrides },
  });
  return { actions, invalidations };
}

async function redirectFrom(work) {
  try {
    await work();
    assert.fail("expected navigation");
  } catch (error) {
    assert.ok(error instanceof Navigation, String(error));
    return new URL(error.location, "https://app.invalid");
  }
}

test("management source uses modal create/edit interactions instead of expandable record editors", () => {
  const page = source("app/(admin)/companies/[id]/management/page.tsx");
  assert.match(page, /title="Add company user"/);
  assert.match(page, /title="Create company role"/);
  assert.match(page, /triggerLabel="Edit"/);
  assert.match(page, /AdminFormFooter/);
  assert.doesNotMatch(page, /<details className="management-record"/);
  assert.doesNotMatch(page, /management-create-panel management-create-inline/);
});

test("role management protects roles referenced by Employee Purchase Role", () => {
  const page = source("app/(admin)/companies/[id]/management/page.tsx");
  assert.match(page, /role\.purchase_employee_count/);
  assert.match(page, /no Employees using the role as their Purchase Role/);
  assert.match(page, /role\.user_count > 0 \|\| role\.purchase_employee_count > 0/);
});

test("employee source keeps history separate while create/edit move to modals", () => {
  const page = source("app/(admin)/companies/[id]/employees/page.tsx");
  assert.match(page, /title="Add employee"/);
  assert.match(page, /triggerLabel="Edit"/);
  assert.match(page, /href=\\{historyHref\\}/);
  assert.match(page, /id="employee-history"/);
  assert.match(page, /Deactivate employee/);
  assert.match(page, /Purchase controls/);
  assert.match(page, /Purchase role/);
  assert.match(page, /does not create a login or grant role permissions/);
  assert.match(page, /purchase-control-\$\{employee\.employee_id\}/);
  assert.doesNotMatch(page, /<details className=\{styles\.employeeRecord\}/);
  assert.doesNotMatch(page, /className=\{styles\.createPanel\}/);
});

test("Employee secondary row actions stay icon-only and accessible", () => {
  const page = source("app/(admin)/companies/[id]/employees/page.tsx");
  assert.match(page, />Actions<\/span>/);
  assert.match(page, /className="admin-employee-icon-link"/);
  assert.match(page, /aria-label=\{`Purchase controls for/);
  assert.match(page, /aria-label=\{`Order history for/);
  assert.match(page, /title="Purchase controls"/);
  assert.match(page, /title="History"/);
  assert.doesNotMatch(page, /<span>Purchase controls<\/span>/);
  assert.doesNotMatch(page, /<span>History<\/span>/);
});
test("portal Employee forms expose Purchase Role as policy-only metadata", () => {
  const page = source("app/(portal)/portal/employees/page.tsx");
  const actions = source("app/(portal)/portal/employees/actions.ts");
  assert.match(page, /Purchase role/);
  assert.match(page, /purchaseControlRoleId/);
  assert.match(page, /does not create a login or grant role permissions/);
  assert.match(actions, /purchase_control_role_id/);
});

test("Employee CSV preserves Purchase Role IDs", () => {
  const csv = source("lib/company-employees-csv.ts");
  assert.match(csv, /purchase_control_role_id/);
  assert.match(csv, /CSV row \$\{rowNumber\} purchase_control_role_id/);
});

test("shared admin modal resets from server state and keeps native dialog semantics", () => {
  const modal = source("components/admin-action-modal.tsx");
  assert.doesNotMatch(modal, /useSearchParams/);
  assert.match(modal, /const resetKey =/);
  assert.match(modal, /modalState\.resetKey === resetKey \? modalState\.open : defaultOpen/);
  assert.match(modal, /closeOnBackdrop=\{false\}/);
  assert.match(modal, /useFormStatus/);
  assert.match(modal, /PurchaseControlDialog/);
});

test("management backend error reopens the same modal and preserves filters without changing payload", async () => {
  const calls = [];
  const h = managementActions({
    updateCompanyUser: async (...args) => { calls.push(args); throw new Error("denied by Fluid"); },
  });
  const data = form({
    companyId: 12, userId: 7, roleId: 3, managerId: 5,
    approvalType: "template", approvalThreshold: "250.50", returnView: "users",
    returnModal: "edit-user-7", returnUserSearch: "alex", returnRoleFilter: "3",
  });
  const url = await redirectFrom(() => h.actions.updateCompanyUserAction(data));
  assert.equal(url.searchParams.get("error"), "denied by Fluid");
  assert.equal(url.searchParams.get("modal"), "edit-user-7");
  assert.equal(url.searchParams.get("userSearch"), "alex");
  assert.equal(url.searchParams.get("role"), "3");
  assert.equal(JSON.stringify(calls), JSON.stringify([[12, {
    user_id: 7, role_id: 3, manager_id: 5, approval_type: "template", approval_threshold: 250.5,
  }]]));
  assert.equal(h.invalidations.length, 0);
});

test("management success closes the modal while preserving list filters", async () => {
  const h = managementActions();
  const data = form({
    companyId: 12, userId: 7, roleId: 3, managerId: "", approvalType: "none", approvalThreshold: "",
    returnView: "users", returnModal: "edit-user-7", returnUserSearch: "alex", returnRoleFilter: "3",
  });
  const url = await redirectFrom(() => h.actions.updateCompanyUserAction(data));
  assert.equal(url.searchParams.get("notice"), "Company user updated.");
  assert.equal(url.searchParams.get("modal"), null);
  assert.equal(url.searchParams.get("userSearch"), "alex");
  assert.equal(url.searchParams.get("role"), "3");
  assert.deepEqual(h.invalidations, ["/companies/12/management"]);
});

test("employee backend error reopens edit modal, preserves filters and preserves the employee input contract", async () => {
  const calls = [];
  const h = employeeActions({
    updateCompanyEmployee: async (...args) => { calls.push(args); throw new Error("employee denied"); },
  });
  const data = form({
    companyId: 4, employeeId: 21, firstName: " Ada ", lastName: " Lovelace ", employeeCode: "AL-1",
    department: "Engineering", costCentre: "CC1", managerCompanyUserId: 8, purchaseControlRoleId: 6, active: "on",
    returnModal: "edit-employee-21", returnQ: "ada", returnStatus: "all", returnFrom: "2026-01-01", returnTo: "2026-09-12", returnPage: 2,
  });
  const url = await redirectFrom(() => h.actions.updateEmployeeAction(data));
  assert.equal(url.searchParams.get("error"), "employee denied");
  assert.equal(url.searchParams.get("modal"), "edit-employee-21");
  assert.equal(url.searchParams.get("q"), "ada");
  assert.equal(url.searchParams.get("status"), "all");
  assert.equal(url.searchParams.get("page"), "2");
  assert.equal(JSON.stringify(calls), JSON.stringify([[4, 21, {
    employee_code: "AL-1", first_name: "Ada", last_name: "Lovelace", department: "Engineering",
    cost_centre: "CC1", manager_company_user_id: 8, purchase_control_role_id: 6, active: true,
  }]]));
  assert.equal(h.invalidations.length, 0);
});

test("Employee purchase controls show policy assignment read-only", () => {
  const page = source("app/(admin)/companies/[id]/employees/page.tsx");
  assert.match(page, /Purchase-control template/);
  assert.match(page, /Inherited from role/);
  assert.match(page, /Purchase-control assignment is read-only here/);
  assert.match(page, /Open role purchase controls/);
  assert.doesNotMatch(page, /assignEmployeePurchaseControlAction/);
  assert.doesNotMatch(page, /Override template/);
  assert.doesNotMatch(page, /Save override/);
});

test("Employee purchase-control assignment stays separate from Apply and closes on success", async () => {
  const calls = [];
  const h = employeeActions({
    assignCompanyEmployeePurchaseControl: async (...args) => { calls.push(args); },
  });
  const data = form({
    companyId: 4, employeeId: 21, templateId: 9, applyNow: "false",
    returnModal: "purchase-control-21", returnQ: "ada", returnStatus: "all", returnPage: 2,
  });
  const url = await redirectFrom(() => h.actions.assignEmployeePurchaseControlAction(data));
  assert.deepEqual(calls, [[4, 21, 9, false]]);
  assert.match(url.searchParams.get("notice"), /not changed/);
  assert.equal(url.searchParams.get("modal"), null);
  assert.equal(url.searchParams.get("q"), "ada");
  assert.equal(url.searchParams.get("page"), "2");
});

test("Employee purchase-control backend error reopens the same routed modal", async () => {
  const h = employeeActions({
    assignCompanyEmployeePurchaseControl: async () => { throw new Error("employee control denied"); },
  });
  const data = form({
    companyId: 4, employeeId: 21, templateId: 9,
    returnModal: "purchase-control-21", returnQ: "ada",
  });
  const url = await redirectFrom(() => h.actions.assignEmployeePurchaseControlAction(data));
  assert.equal(url.searchParams.get("error"), "employee control denied");
  assert.equal(url.searchParams.get("modal"), "purchase-control-21");
});

test("Employee Apply and Reset require explicit confirmation and keep rolling-reset copy honest", async () => {
  const applyCalls = [];
  const applyHarness = employeeActions({
    applyCompanyEmployeePurchaseControl: async (...args) => { applyCalls.push(args); },
  });
  const base = {
    companyId: 4, employeeId: 21, returnModal: "purchase-control-21",
  };
  let url = await redirectFrom(() => applyHarness.actions.applyEmployeePurchaseControlAction(form(base)));
  assert.match(url.searchParams.get("error"), /Confirm/);
  assert.equal(applyCalls.length, 0);

  url = await redirectFrom(() => applyHarness.actions.applyEmployeePurchaseControlAction(form({
    ...base, confirmApply: "yes",
  })));
  assert.deepEqual(applyCalls, [[4, 21]]);
  assert.match(url.searchParams.get("notice"), /rolling usage remains based on purchase history/i);

  const resetCalls = [];
  const resetHarness = employeeActions({
    resetCompanyEmployeePurchaseControl: async (...args) => { resetCalls.push(args); },
  });
  url = await redirectFrom(() => resetHarness.actions.resetEmployeePurchaseControlAction(form({
    ...base, confirmReset: "yes",
  })));
  assert.deepEqual(resetCalls, [[4, 21]]);
  assert.match(url.searchParams.get("notice"), /Rolling-window usage was not reset/);
});

