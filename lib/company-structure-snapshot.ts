import type { CompanySummary } from "@/lib/graphql/companies";
import type { CompanyManagement } from "@/lib/graphql/company-management";
import type { CompanyControlsBundle } from "@/lib/graphql/company-controls";
import type { SnapshotRow, SnapshotSheet } from "@/lib/simple-xlsx";

export type StructureSnapshotCompany = {
  company: CompanySummary;
  management: CompanyManagement;
  controls: CompanyControlsBundle;
};

function line(values: SnapshotRow["values"], style: SnapshotRow["style"] = "normal"): SnapshotRow {
  return { values, style };
}
function section(rows: SnapshotRow[], title: string, headers: string[]) {
  rows.push(line([]), line([title], "section"), line(headers, "heading"));
}
function productMode(restricted: boolean, count: number) {
  if (!restricted) return "No additional product restriction";
  return count === 0 ? "Restricted — empty product list" : "Restricted — " + count + " allowed SKUs";
}
function roleProductMode(preselectAll: boolean, count: number) {
  if (preselectAll) return "Preselect all products";
  return count === 0 ? "Explicit empty SKU list" : "Explicit list — " + count + " SKUs";
}
function yesNo(value: boolean) { return value ? "Yes" : "No"; }
function normalized(value: string) { return value.trim().toLocaleLowerCase("en"); }

/**
 * Render user/role membership and stored product policy from authorised Fluid
 * Admin reads. It is deliberately NOT a calculated effective product catalogue.
 */
export function makeCompanyStructureSnapshotSheets(
  root: CompanySummary,
  companies: StructureSnapshotCompany[],
  startedAt: string,
  finishedAt: string,
): SnapshotSheet[] {
  if (!companies.length) throw new Error("A snapshot needs at least one company.");
  const ids = new Set<number>();
  for (const { company, management, controls } of companies) {
    if (ids.has(company.company_id)) throw new Error("The structure contains a duplicate company.");
    ids.add(company.company_id);
    if (management.company_id !== company.company_id || controls.company_id !== company.company_id) {
      throw new Error("Company " + company.company_id + " returned mismatched snapshot data.");
    }
  }
  if (!ids.has(root.company_id)) throw new Error("The group head is absent from the snapshot.");

  const byId = new Map(companies.map(({ company }) => [company.company_id, company]));
  const summary: SnapshotRow[] = [
    line(["COMPANY STRUCTURE SNAPSHOT"], "title"),
    line(["Group head", root.reference || "Company " + root.company_id, root.name], "note"),
    line(["Collection started (UTC)", startedAt, "Completed (UTC)", finishedAt], "note"),
    line(["Read-only configuration export for companies visible to the current Staff Admin. Collected over a period; not an atomic database snapshot or effective product entitlement report."], "note"),
    line([]),
    line(["COMPANIES IN VISIBLE STRUCTURE"], "section"),
    line(["Reference", "Company", "Magento ID", "Parent reference", "Active", "Users", "Roles", "Public catalogue", "Company product policy", "Stored company SKUs"], "heading"),
  ];
  for (const { company, management, controls } of companies) {
    const parent = company.parent_company_id === null ? null : byId.get(company.parent_company_id);
    const policy = controls.company_catalog;
    summary.push(line([
      company.reference || "Company " + company.company_id,
      company.name, company.company_id,
      parent?.reference || (company.parent_company_id === null ? "Group head" : "Company " + company.parent_company_id),
      yesNo(company.status), management.users.length, management.roles.length,
      yesNo(policy.allow_public_catalog),
      productMode(policy.product_restriction, policy.allowed_product_skus.length),
      policy.allowed_product_skus.length,
    ]));
  }
  const sheets: SnapshotSheet[] = [{ name: "Summary", rows: summary, freezeRows: 7, mergeTitle: true }];

  for (const { company, management, controls } of companies) {
    const ref = company.reference || "Company " + company.company_id;
    const usersById = new Map(management.users.map(user => [user.user_id, user]));
    const parent = company.parent_company_id === null ? null : byId.get(company.parent_company_id);
    const policy = controls.company_catalog;
    const controlsByRole = new Map(controls.role_controls.map(role => [normalized(role.role_name), role]));
    const roleMembers = new Map<string, typeof management.users>();
    for (const user of management.users) for (const role of user.roles) {
      const key = normalized(role.name);
      roleMembers.set(key, [...(roleMembers.get(key) ?? []), user]);
    }
    const rows: SnapshotRow[] = [
      line([ref + " — " + company.name], "title"),
      line(["Magento ID", company.company_id, "Active", yesNo(company.status), "Parent",
        parent?.reference || (company.parent_company_id === null ? "Group head" : "Company " + company.parent_company_id)], "note"),
      line(["Collection started (UTC)", startedAt, "Completed (UTC)", finishedAt,
        "Public catalogue", yesNo(policy.allow_public_catalog)], "note"),
      line(["Read-only users, roles and stored product settings. These do not compute effective product eligibility; no changes were made."], "note"),
    ];

    section(rows, "COMPANY PRODUCT POLICY", ["Setting", "Value", "Details"]);
    rows.push(
      line(["Public catalogue allowed", yesNo(policy.allow_public_catalog)]),
      line(["Company product restriction", yesNo(policy.product_restriction),
        productMode(policy.product_restriction, policy.allowed_product_skus.length)]),
      line(["Stored company product SKU entries", policy.allowed_product_skus.length,
        "May be inactive while the restriction is off"]),
    );

    section(rows, "COMPANY USERS (" + management.users.length + ")",
      ["Customer ID", "User ID", "First name", "Last name", "Email", "Assigned role(s)",
        "Company admin", "Manager", "Approval type", "Threshold"]);
    if (!management.users.length) rows.push(line(["No users returned"]));
    for (const user of management.users) {
      const manager = user.manager_user_id === null ? null : usersById.get(user.manager_user_id);
      rows.push(line([
        user.customer_id, user.user_id, user.firstname, user.lastname, user.email,
        user.roles.map(role => role.name).join(" | ") || "None returned",
        yesNo(user.is_company_admin),
        manager?.email || (user.manager_user_id === null ? "None" : "User " + user.manager_user_id),
        user.approval_type, user.approval_threshold,
      ]));
    }

    section(rows, "COMPANY ROLES (" + management.roles.length + ")",
      ["Role ID", "Role name", "Assigned users", "Reported user count", "Purchase employees",
        "Sort order", "Manageable", "Role product mode", "Stored role SKUs"]);
    if (!management.roles.length) rows.push(line(["No roles returned"]));
    for (const role of management.roles) {
      const control = controlsByRole.get(normalized(role.name));
      rows.push(line([
        role.role_id, role.name, roleMembers.get(normalized(role.name))?.length ?? 0,
        role.user_count, role.purchase_employee_count, role.sort_order,
        yesNo(role.manageable),
        control ? roleProductMode(control.preselect_all_products, control.allowed_product_skus.length) :
          "Not returned by controls export",
        control?.allowed_product_skus.length ?? null,
      ]));
    }

    section(rows, "ROLE MEMBERSHIPS", ["Role", "Email", "First name", "Last name", "Company admin"]);
    let membershipCount = 0;
    for (const user of management.users) for (const role of user.roles) {
      rows.push(line([role.name, user.email, user.firstname, user.lastname, yesNo(user.is_company_admin)]));
      membershipCount += 1;
    }
    if (!membershipCount) rows.push(line(["No user-role assignments returned"]));

    section(rows, "COMPANY ALLOWED PRODUCT SKUS", ["Product mode", "SKU"]);
    if (!policy.product_restriction) rows.push(line(["No additional product restriction"]));
    else if (!policy.allowed_product_skus.length) rows.push(line(["Restricted — empty product list"]));
    for (const sku of policy.allowed_product_skus) {
      rows.push(line([policy.product_restriction ? "Restricted" :
        "Saved, inactive while restriction is off", sku]));
    }

    section(rows, "ROLE PRODUCT SETTINGS", ["Role", "Product mode", "SKU", "Meaning"]);
    const listedRoles = new Set<string>();
    for (const role of management.roles) {
      const key = normalized(role.name);
      listedRoles.add(key);
      const control = controlsByRole.get(key);
      if (!control) {
        rows.push(line([role.name, "Not returned by controls export", "",
          "Cannot infer a product restriction"]));
        continue;
      }
      const mode = roleProductMode(control.preselect_all_products, control.allowed_product_skus.length);
      if (!control.allowed_product_skus.length) {
        rows.push(line([role.name, mode, "", "No stored role SKU entries"]));
      } else {
        for (const sku of control.allowed_product_skus) {
          rows.push(line([role.name, mode, sku, "Stored role SKU entry"]));
        }
      }
    }
    // Preserve controls-only or legacy role entries rather than hiding them.
    for (const control of controls.role_controls) {
      if (listedRoles.has(normalized(control.role_name))) continue;
      const mode = roleProductMode(control.preselect_all_products, control.allowed_product_skus.length);
      if (!control.allowed_product_skus.length) {
        rows.push(line([control.role_name, mode, "", "Controls-only role; no stored SKU entries"]));
      } else {
        for (const sku of control.allowed_product_skus) {
          rows.push(line([control.role_name, mode, sku, "Controls-only role SKU entry"]));
        }
      }
    }
    rows.push(line([]), line(["Source: Fluid Admin company management and company-controls export. Read-only snapshot; no policies were changed."], "note"));
    sheets.push({ name: ref, rows, freezeRows: 4, mergeTitle: true });
  }
  return sheets;
}
