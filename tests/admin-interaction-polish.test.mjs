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
    createCompanyEmployee: async () => {},
    deactivateCompanyEmployee: async () => {},
    importCompanyEmployees: async () => ({ failed: 0, errors: [] }),
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

test("employee source keeps history separate while create/edit move to modals", () => {
  const page = source("app/(admin)/companies/[id]/employees/page.tsx");
  assert.match(page, /title="Add employee"/);
  assert.match(page, /triggerLabel="Edit"/);
  assert.match(page, /admin-employee-history-link/);
  assert.match(page, /id="employee-history"/);
  assert.match(page, /Deactivate employee/);
  assert.doesNotMatch(page, /<details className=\{styles\.employeeRecord\}/);
  assert.doesNotMatch(page, /className=\{styles\.createPanel\}/);
});

test("shared admin modal resets from server state and keeps native dialog semantics", () => {
  const modal = source("components/admin-action-modal.tsx");
  assert.doesNotMatch(modal, /useSearchParams/);
  assert.match(modal, /setOpen\(defaultOpen\)/);
  assert.match(modal, /\[defaultOpen, stateKey\]/);
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
    department: "Engineering", costCentre: "CC1", managerCompanyUserId: 8, active: "on",
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
    cost_centre: "CC1", manager_company_user_id: 8, active: true,
  }]]));
  assert.equal(h.invalidations.length, 0);
});
