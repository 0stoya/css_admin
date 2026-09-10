"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import { parseEmployeeCsv, resolveEmployeeCsvManagers } from "@/lib/company-employees-csv";
import { getCompanyManagement } from "@/lib/graphql/company-management";
import {
  createCompanyEmployee,
  deactivateCompanyEmployee,
  importCompanyEmployees,
  saveCompanyEmployeeConfiguration,
  updateCompanyEmployee,
  type CompanyEmployeeInput,
} from "@/lib/graphql/company-employees";

function employeesPath(companyId: number) {
  return `/companies/${companyId}/employees`;
}

function positiveInt(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  const value = Number(raw);
  if (!raw || !Number.isInteger(value) || value <= 0) throw new Error(`${key} must be a positive integer.`);
  return value;
}

function optionalPositiveInt(value: string, label: string) {
  const raw = value.trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive integer when supplied.`);
  return parsed;
}

function stringValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function nullableString(formData: FormData, key: string) {
  const value = stringValue(formData, key);
  return value || null;
}

function employeeInput(formData: FormData): CompanyEmployeeInput {
  const firstName = stringValue(formData, "firstName");
  const lastName = stringValue(formData, "lastName");
  if (!firstName || !lastName) throw new Error("First name and last name are required.");

  return {
    employee_code: nullableString(formData, "employeeCode"),
    first_name: firstName,
    last_name: lastName,
    department: nullableString(formData, "department"),
    cost_centre: nullableString(formData, "costCentre"),
    manager_company_user_id: optionalPositiveInt(stringValue(formData, "managerCompanyUserId"), "Manager"),
    active: formData.get("active") === "on",
  };
}

async function runMutation(companyId: number, notice: string, work: () => Promise<unknown>) {
  let errorMessage: string | null = null;
  try {
    await work();
    revalidatePath(employeesPath(companyId));
  } catch (error) {
    errorMessage = graphQLErrorMessage(error);
  }

  const query = new URLSearchParams();
  if (errorMessage) query.set("error", errorMessage);
  else query.set("notice", notice);
  redirect(`${employeesPath(companyId)}?${query.toString()}`);
}

export async function saveEmployeeConfigurationAction(formData: FormData) {
  const companyId = positiveInt(formData, "companyId");
  const usesEmployee = formData.get("usesEmployee") === "on";
  const multiEmployeeBasket = formData.get("multiEmployeeBasket") === "on";
  if (multiEmployeeBasket && !usesEmployee) {
    return runMutation(companyId, "", async () => {
      throw new Error("Multi-employee baskets require Uses employees to be enabled.");
    });
  }

  return runMutation(companyId, "Employee ordering settings updated.", () =>
    saveCompanyEmployeeConfiguration(companyId, {
      uses_employee: usesEmployee,
      multi_employee_basket: multiEmployeeBasket,
    }),
  );
}

export async function createEmployeeAction(formData: FormData) {
  const companyId = positiveInt(formData, "companyId");
  return runMutation(companyId, "Employee created.", () => createCompanyEmployee(companyId, employeeInput(formData)));
}

export async function updateEmployeeAction(formData: FormData) {
  const companyId = positiveInt(formData, "companyId");
  const employeeId = positiveInt(formData, "employeeId");
  return runMutation(companyId, "Employee updated.", () =>
    updateCompanyEmployee(companyId, employeeId, employeeInput(formData)),
  );
}

export async function deactivateEmployeeAction(formData: FormData) {
  const companyId = positiveInt(formData, "companyId");
  const employeeId = positiveInt(formData, "employeeId");
  return runMutation(companyId, "Employee deactivated. Historical order attribution remains available.", () =>
    deactivateCompanyEmployee(companyId, employeeId),
  );
}

export async function importEmployeesCsvAction(formData: FormData) {
  const companyId = positiveInt(formData, "companyId");
  const upload = formData.get("employeeCsv");

  return runMutation(companyId, "Employee CSV imported.", async () => {
    if (!(upload instanceof File) || upload.size === 0) throw new Error("Choose a non-empty employee CSV file.");
    if (upload.size > 2_000_000) throw new Error("Employee CSV must be 2 MB or smaller.");

    const parsedRows = parseEmployeeCsv(await upload.text());
    let managers: Array<{ user_id: number; email: string }> = [];

    if (parsedRows.some((row) => Boolean(row.manager_email))) {
      const management = await getCompanyManagement(companyId);
      managers = management.users.map((user) => ({ user_id: user.user_id, email: user.email }));
    }

    const rows = resolveEmployeeCsvManagers(parsedRows, managers);
    const result = await importCompanyEmployees(companyId, rows);
    if (result.failed > 0) {
      const details = result.errors.slice(0, 3).map((item) => `row ${item.row}: ${item.message}`).join("; ");
      throw new Error(`Employee import completed with ${result.failed} failed row(s). ${details}`);
    }
  });
}
