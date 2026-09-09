import type { CompanyEmployeeExportRow, CompanyEmployeeImportRow } from "@/lib/graphql/company-employees";

export const EMPLOYEE_IMPORT_TEMPLATE =
  "employee_code,first_name,last_name,department,cost_centre,manager_company_user_id,active\n" +
  "EMP001,Spencer,Surname,Warehouse,CC100,,true\n";

function optionalPositiveInt(value: string, label: string) {
  const raw = value.trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive integer when supplied.`);
  return parsed;
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") field += char;
  }

  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((values) => values.some((value) => value.trim() !== ""));
}

function importBoolean(value: string, rowNumber: number) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  if (["1", "true", "yes", "y", "active"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "inactive"].includes(normalized)) return false;
  throw new Error(`CSV row ${rowNumber}: active must be true/false, yes/no or 1/0.`);
}

export function parseEmployeeCsv(text: string): CompanyEmployeeImportRow[] {
  const rows = parseCsv(text.replace(/^\uFEFF/, ""));
  if (rows.length < 2) throw new Error("CSV must contain a header row and at least one employee row.");

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  for (const header of ["first_name", "last_name"]) {
    if (!headers.includes(header)) throw new Error(`CSV is missing required header ${header}.`);
  }

  const valueAt = (values: string[], header: string) => {
    const index = headers.indexOf(header);
    return index < 0 ? "" : String(values[index] ?? "").trim();
  };

  return rows.slice(1).map((values, index) => {
    const rowNumber = index + 2;
    const firstName = valueAt(values, "first_name");
    const lastName = valueAt(values, "last_name");
    if (!firstName || !lastName) throw new Error(`CSV row ${rowNumber}: first_name and last_name are required.`);

    return {
      employee_code: valueAt(values, "employee_code") || null,
      first_name: firstName,
      last_name: lastName,
      department: valueAt(values, "department") || null,
      cost_centre: valueAt(values, "cost_centre") || null,
      manager_company_user_id: optionalPositiveInt(
        valueAt(values, "manager_company_user_id"),
        `CSV row ${rowNumber} manager_company_user_id`,
      ),
      active: importBoolean(valueAt(values, "active"), rowNumber),
    };
  });
}

function csvCell(value: string | number | boolean | null) {
  const text = value === null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function employeeExportCsv(rows: CompanyEmployeeExportRow[]) {
  const headers = [
    "employee_code",
    "first_name",
    "last_name",
    "department",
    "cost_centre",
    "manager_company_user_id",
    "active",
  ];

  return [
    headers.join(","),
    ...rows.map((row) => [
      row.employee_code,
      row.first_name,
      row.last_name,
      row.department,
      row.cost_centre,
      row.manager_company_user_id,
      row.active,
    ].map(csvCell).join(",")),
  ].join("\r\n");
}
