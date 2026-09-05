import { parseCsv, stringifyCsv } from "@/lib/csv";
import { GraphQLRequestError } from "@/lib/graphql/client";
import {
  addCompanyUser,
  getCompanyCustomerCandidates,
  getCompanyManagement,
  updateCompanyUser,
  type CompanyAdminRole,
  type CompanyAdminUser,
} from "@/lib/graphql/company-management";
import type { CompanyUserImportRow, ImportRowStatus } from "@/lib/import-export-types";

const CSV_HEADERS = ["email", "role_name", "manager_email", "approval_type", "approval_threshold"] as const;
const APPROVAL_TYPES = new Set(["all", "template", "value", "none"]);
const MAX_ROWS = 100;

type ParsedRow = {
  row: number;
  email: string;
  roleName: string;
  managerEmail: string;
  approvalType: string;
  approvalThreshold: number | null;
  parseError: string | null;
};

type PlannedRow = ParsedRow & {
  status: ImportRowStatus;
  message: string;
  roleId: number | null;
  customerId: number | null;
  userId: number | null;
};

type ImportPlan = {
  rows: PlannedRow[];
  existingUsers: CompanyAdminUser[];
};

function normalized(value: string) {
  return value.trim().toLocaleLowerCase("en");
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseThreshold(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return { value: null, error: null };
  const number = Number(trimmed);
  if (!Number.isFinite(number) || number < 0) {
    return { value: null, error: "Approval threshold must be zero or greater, or blank." };
  }
  return { value: number, error: null };
}

function parseCompanyUserCsv(source: string) {
  const rows = parseCsv(source).filter((row) => row.some((value) => value.trim() !== ""));
  if (!rows.length) throw new Error("The CSV file is empty.");

  const headers = rows[0].map(normalized);
  const unknownHeaders = headers.filter((header) => !CSV_HEADERS.includes(header as (typeof CSV_HEADERS)[number]));
  const missingHeaders = CSV_HEADERS.filter((header) => !headers.includes(header));
  if (unknownHeaders.length || missingHeaders.length || new Set(headers).size !== headers.length) {
    throw new Error(`CSV headers must be exactly: ${CSV_HEADERS.join(", ")}.`);
  }

  const dataRows = rows.slice(1);
  if (!dataRows.length) throw new Error("The CSV file contains no company-user rows.");
  if (dataRows.length > MAX_ROWS) throw new Error(`CSV import is limited to ${MAX_ROWS} rows per preview.`);

  const column = Object.fromEntries(headers.map((header, index) => [header, index]));
  return dataRows.map((values, index): ParsedRow => {
    const email = normalized(values[column.email] ?? "");
    const roleName = (values[column.role_name] ?? "").trim();
    const managerEmail = normalized(values[column.manager_email] ?? "");
    const approvalType = normalized(values[column.approval_type] ?? "") || "all";
    const threshold = parseThreshold(values[column.approval_threshold] ?? "");
    let parseError = threshold.error;

    if (!validEmail(email)) parseError = "Enter a valid email address.";
    else if (!roleName) parseError = "Role name is required.";
    else if (managerEmail && !validEmail(managerEmail)) parseError = "Manager email must be valid or blank.";
    else if (managerEmail === email) parseError = "A company user cannot be their own manager.";
    else if (!APPROVAL_TYPES.has(approvalType)) parseError = "Approval type must be all, template, value, or none.";

    return {
      row: index + 2,
      email,
      roleName,
      managerEmail,
      approvalType,
      approvalThreshold: threshold.value,
      parseError,
    };
  });
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, work: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await work(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

function roleIndex(roles: CompanyAdminRole[]) {
  return new Map(roles.filter((role) => role.role_id > 0).map((role) => [normalized(role.name), role]));
}

function currentManagerEmail(user: CompanyAdminUser, usersById: Map<number, CompanyAdminUser>) {
  if (user.manager_user_id === null) return "";
  return normalized(usersById.get(user.manager_user_id)?.email ?? `missing-user-${user.manager_user_id}`);
}

function sameThreshold(left: number | null, right: number | null) {
  return left === right;
}

async function buildImportPlan(companyId: number, source: string): Promise<ImportPlan> {
  const parsedRows = parseCompanyUserCsv(source);
  const management = await getCompanyManagement(companyId);
  const existingByEmail = new Map(management.users.map((user) => [normalized(user.email), user]));
  const usersById = new Map(management.users.map((user) => [user.user_id, user]));
  const rolesByName = roleIndex(management.roles);
  const emailCounts = new Map<string, number>();
  parsedRows.forEach((row) => emailCounts.set(row.email, (emailCounts.get(row.email) ?? 0) + 1));

  const candidateEmails = parsedRows
    .filter((row) => !row.parseError && emailCounts.get(row.email) === 1 && !existingByEmail.has(row.email))
    .map((row) => row.email);
  const candidateResults = await mapWithConcurrency(candidateEmails, 8, async (email) => {
    const result = await getCompanyCustomerCandidates(companyId, 1, 100, email);
    return [email, result.items.find((candidate) => normalized(candidate.email) === email) ?? null] as const;
  });
  const candidatesByEmail = new Map(candidateResults);

  const plannedRows = parsedRows.map((row): PlannedRow => {
    const base = { ...row, roleId: null, customerId: null, userId: null };
    if (row.parseError) return { ...base, status: "Error", message: row.parseError };
    if ((emailCounts.get(row.email) ?? 0) > 1) {
      return { ...base, status: "Error", message: "Email appears more than once in this CSV." };
    }

    const existing = existingByEmail.get(row.email);
    if (existing?.is_company_admin) {
      return { ...base, userId: existing.user_id, status: "Skipped", message: "Company administrator is protected by Fluid." };
    }

    const role = rolesByName.get(normalized(row.roleName));
    if (!role) return { ...base, status: "Error", message: `Company role “${row.roleName}” was not found.` };

    if (existing) {
      const unchanged = normalized(existing.roles[0]?.name ?? "") === normalized(role.name)
        && currentManagerEmail(existing, usersById) === row.managerEmail
        && normalized(existing.approval_type) === row.approvalType
        && sameThreshold(existing.approval_threshold, row.approvalThreshold);
      return {
        ...base,
        roleId: role.role_id,
        customerId: existing.customer_id,
        userId: existing.user_id,
        status: unchanged ? "Skipped" : "Updated",
        message: unchanged ? "No changes detected." : "Existing company user will be updated.",
      };
    }

    const candidate = candidatesByEmail.get(row.email);
    if (!candidate) {
      return { ...base, roleId: role.role_id, status: "Error", message: "Existing Magento customer was not found." };
    }
    if (candidate.assigned_to_company) {
      return { ...base, roleId: role.role_id, status: "Error", message: "Customer is already assigned to this company." };
    }

    return {
      ...base,
      roleId: role.role_id,
      customerId: candidate.customer_id,
      status: "Created",
      message: "Existing Magento customer will be linked to the company.",
    };
  });

  const plannedByEmail = new Map(plannedRows.map((row) => [row.email, row]));
  plannedRows.forEach((row) => {
    if (row.status === "Error" || row.status === "Skipped" || !row.managerEmail) return;
    if (existingByEmail.has(row.managerEmail)) return;
    const managerRow = plannedByEmail.get(row.managerEmail);
    if (!managerRow || managerRow.status !== "Created") {
      row.status = "Error";
      row.message = "Manager must already belong to the company or be a valid Created row in this CSV.";
    }
  });

  const availableEmails = new Set(existingByEmail.keys());
  let pending = plannedRows.filter((row) => row.status === "Created");
  while (pending.length) {
    const ready = pending.filter((row) => !row.managerEmail || availableEmails.has(row.managerEmail));
    if (!ready.length) {
      pending.forEach((row) => {
        row.status = "Error";
        row.message = "Manager dependencies contain a cycle or an unavailable user.";
      });
      break;
    }
    ready.forEach((row) => availableEmails.add(row.email));
    const readyEmails = new Set(ready.map((row) => row.email));
    pending = pending.filter((row) => !readyEmails.has(row.email));
  }

  return { rows: plannedRows, existingUsers: management.users };
}

function publicRow(row: PlannedRow): CompanyUserImportRow {
  return {
    row: row.row,
    email: row.email,
    role_name: row.roleName,
    manager_email: row.managerEmail,
    approval_type: row.approvalType,
    approval_threshold: row.approvalThreshold,
    status: row.status,
    message: row.message,
  };
}

export async function previewCompanyUserImport(companyId: number, source: string) {
  const plan = await buildImportPlan(companyId, source);
  return plan.rows.map(publicRow);
}

export async function applyCompanyUserImport(companyId: number, source: string) {
  const plan = await buildImportPlan(companyId, source);
  const resultRows = plan.rows.map(publicRow);
  const resultByRow = new Map(resultRows.map((row) => [row.row, row]));
  const liveUsers = new Map(plan.existingUsers.map((user) => [normalized(user.email), user.user_id]));

  let pendingCreates = plan.rows.filter((row) => row.status === "Created");
  while (pendingCreates.length) {
    const ready = pendingCreates.filter((row) => !row.managerEmail || liveUsers.has(row.managerEmail));
    if (!ready.length) {
      pendingCreates.forEach((row) => {
        const result = resultByRow.get(row.row)!;
        result.status = "Error";
        result.message = "Manager was not available after preceding rows were applied.";
      });
      break;
    }

    for (const row of ready) {
      const result = resultByRow.get(row.row)!;
      try {
        const saved = await addCompanyUser(companyId, {
          customer_id: row.customerId!,
          role_id: row.roleId!,
          manager_id: row.managerEmail ? liveUsers.get(row.managerEmail)! : null,
          approval_type: row.approvalType,
          approval_threshold: row.approvalThreshold,
        });
        liveUsers.set(row.email, saved.user_id);
        result.message = "Company user created.";
      } catch (error) {
        if (error instanceof GraphQLRequestError && error.status === 401) throw error;
        result.status = "Error";
        result.message = error instanceof Error ? error.message : "Backend rejected the company-user create.";
      }
    }

    const readyEmails = new Set(ready.map((row) => row.email));
    pendingCreates = pendingCreates.filter((row) => !readyEmails.has(row.email));
  }

  for (const row of plan.rows.filter((item) => item.status === "Updated")) {
    const result = resultByRow.get(row.row)!;
    const managerId = row.managerEmail ? liveUsers.get(row.managerEmail) : null;
    if (row.managerEmail && !managerId) {
      result.status = "Error";
      result.message = "Manager was not available after preceding rows were applied.";
      continue;
    }

    try {
      await updateCompanyUser(companyId, {
        user_id: row.userId!,
        role_id: row.roleId!,
        manager_id: managerId ?? null,
        approval_type: row.approvalType,
        approval_threshold: row.approvalThreshold,
      });
      result.message = "Company user updated.";
    } catch (error) {
      if (error instanceof GraphQLRequestError && error.status === 401) throw error;
      result.status = "Error";
      result.message = error instanceof Error ? error.message : "Backend rejected the company-user update.";
    }
  }

  return resultRows;
}

export function exportCompanyUsersCsv(users: CompanyAdminUser[]) {
  const usersById = new Map(users.map((user) => [user.user_id, user]));
  const rows: Array<Array<string | number>> = [CSV_HEADERS.slice()];
  users.forEach((user) => {
    rows.push([
      normalized(user.email),
      user.roles[0]?.name ?? "",
      user.manager_user_id === null ? "" : usersById.get(user.manager_user_id)?.email ?? "",
      user.approval_type,
      user.approval_threshold ?? "",
    ]);
  });
  return `\uFEFF${stringifyCsv(rows)}\r\n`;
}
