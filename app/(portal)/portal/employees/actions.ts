"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseEmployeeCsv } from "@/lib/company-employees-csv";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import {
  createPortalEmployee,
  deactivatePortalEmployee,
  importPortalEmployees,
  savePortalEmployeeConfiguration,
  updatePortalEmployee,
} from "@/lib/graphql/company-portal-employees";
import type { CompanyEmployeeInput } from "@/lib/graphql/company-employees";

const PATH = "/portal/employees";

function positiveInt(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  const value = Number(raw);
  if (!raw || !Number.isInteger(value) || value <= 0) throw new Error(`${key} must be a positive integer.`);
  return value;
}

function stringValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalPositiveInt(value: string, label: string) {
  const raw = value.trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive integer when supplied.`);
  return parsed;
}

function employeeInput(formData: FormData): CompanyEmployeeInput {
  const firstName = stringValue(formData, "firstName");
  const lastName = stringValue(formData, "lastName");
  if (!firstName || !lastName) throw new Error("First name and last name are required.");
  const optional = (key: string) => stringValue(formData, key) || null;
  return {
    employee_code: optional("employeeCode"),
    first_name: firstName,
    last_name: lastName,
    department: optional("department"),
    cost_centre: optional("costCentre"),
    manager_company_user_id: optionalPositiveInt(stringValue(formData, "managerCompanyUserId"), "Manager"),
    active: formData.get("active") === "on",
  };
}

async function runMutation(notice: string, work: () => Promise<unknown>) {
  let errorMessage: string | null = null;
  try {
    await work();
    revalidatePath(PATH);
  } catch (error) {
    errorMessage = graphQLErrorMessage(error);
  }
  const query = new URLSearchParams();
  if (errorMessage) query.set("error", errorMessage);
  else query.set("notice", notice);
  redirect(`${PATH}?${query.toString()}`);
}

export async function savePortalEmployeeConfigurationAction(formData: FormData) {
  const usesEmployee = formData.get("usesEmployee") === "on";
  const multiEmployeeBasket = formData.get("multiEmployeeBasket") === "on";
  if (multiEmployeeBasket && !usesEmployee) {
    return runMutation("", async () => {
      throw new Error("Multi-employee baskets require Uses employees to be enabled.");
    });
  }
  return runMutation("Employee ordering settings updated.", () =>
    savePortalEmployeeConfiguration({ uses_employee: usesEmployee, multi_employee_basket: multiEmployeeBasket }),
  );
}

export async function createPortalEmployeeAction(formData: FormData) {
  return runMutation("Employee created.", () => createPortalEmployee(employeeInput(formData)));
}

export async function updatePortalEmployeeAction(formData: FormData) {
  const employeeId = positiveInt(formData, "employeeId");
  return runMutation("Employee updated.", () => updatePortalEmployee(employeeId, employeeInput(formData)));
}

export async function deactivatePortalEmployeeAction(formData: FormData) {
  const employeeId = positiveInt(formData, "employeeId");
  return runMutation("Employee deactivated. Historical attribution remains available.", () => deactivatePortalEmployee(employeeId));
}

export async function importPortalEmployeesCsvAction(formData: FormData) {
  const upload = formData.get("employeeCsv");
  return runMutation("Employee CSV imported.", async () => {
    if (!(upload instanceof File) || upload.size === 0) throw new Error("Choose a non-empty employee CSV file.");
    if (upload.size > 2_000_000) throw new Error("Employee CSV must be 2 MB or smaller.");
    const result = await importPortalEmployees(parseEmployeeCsv(await upload.text()));
    if (result.failed > 0) {
      const details = result.errors.slice(0, 3).map((item) => `row ${item.row}: ${item.message}`).join("; ");
      throw new Error(`Employee import completed with ${result.failed} failed row(s). ${details}`);
    }
  });
}
