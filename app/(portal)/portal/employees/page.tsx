import Link from "next/link";
import { EMPLOYEE_IMPORT_TEMPLATE } from "@/lib/company-employees-csv";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import {
  getCompanyPortalAdministration,
  getCompanyPortalContext,
  type CompanyPortalAdministration,
  type CompanyPortalUser,
} from "@/lib/graphql/company-portal";
import {
  getPortalEmployee,
  getPortalEmployeeConfiguration,
  getPortalEmployeeOrders,
  getPortalEmployees,
  getPortalEmployeeSpend,
} from "@/lib/graphql/company-portal-employees";
import type { CompanyEmployee } from "@/lib/graphql/company-employees";
import {
  createPortalEmployeeAction,
  deactivatePortalEmployeeAction,
  importPortalEmployeesCsvAction,
  savePortalEmployeeConfigurationAction,
  updatePortalEmployeeAction,
} from "./actions";
import styles from "@/components/portal/portal-employees.module.css";

const PAGE_SIZE = 25;
const ORDER_PAGE_SIZE = 15;

type SearchParams = Record<string, string | string[] | undefined>;
type EmployeeStatus = "all" | "active" | "inactive";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function positivePage(value: string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function statusValue(value: string | undefined): EmployeeStatus {
  if (value === "inactive") return "inactive";
  if (value === "all") return "all";
  return "active";
}

function activeFilter(status: EmployeeStatus) {
  return status === "all" ? undefined : status === "active";
}

function employeeName(employee: CompanyEmployee) {
  return employee.full_name.trim() || `${employee.first_name} ${employee.last_name}`.trim();
}

function userName(user: Pick<CompanyPortalUser, "firstname" | "lastname" | "email">) {
  return `${user.firstname} ${user.lastname}`.trim() || user.email;
}

function employeePermissions(administration: CompanyPortalAdministration | null) {
  if (!administration) return { canView: true, canManage: false };
  if (administration.is_company_admin) return { canView: true, canManage: true };
  const current = administration.users.find((user) => user.user_id === administration.company_user_id);
  const resources = new Set(current?.roles.flatMap((role) => role.allowed_resources) ?? []);
  const canManage = resources.has("Css_Commerce::company_employees_manage");
  return { canView: canManage || resources.has("Css_Commerce::company_employees_view"), canManage };
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

function withQuery(values: Record<string, string | number | null | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined && String(value) !== "") query.set(key, String(value));
  }
  const suffix = query.toString();
  return `/portal/employees${suffix ? `?${suffix}` : ""}`;
}

function ManagerSelect({ users, employee }: { users: CompanyPortalUser[]; employee?: CompanyEmployee }) {
  return (
    <select name="managerCompanyUserId" defaultValue={employee?.manager_company_user_id ?? ""}>
      <option value="">No manager</option>
      {users.map((user) => <option key={user.user_id} value={user.user_id}>{userName(user)}</option>)}
    </select>
  );
}

function EmployeeFields({ users, employee }: { users: CompanyPortalUser[]; employee?: CompanyEmployee }) {
  return (
    <div className={styles.formGrid}>
      <div className="field"><label>First name</label><input name="firstName" defaultValue={employee?.first_name ?? ""} required /></div>
      <div className="field"><label>Last name</label><input name="lastName" defaultValue={employee?.last_name ?? ""} required /></div>
      <div className="field"><label>Employee code</label><input name="employeeCode" defaultValue={employee?.employee_code ?? ""} /></div>
      <div className="field"><label>Department</label><input name="department" defaultValue={employee?.department ?? ""} /></div>
      <div className="field"><label>Cost centre</label><input name="costCentre" defaultValue={employee?.cost_centre ?? ""} /></div>
      <div className="field"><label>Manager</label><ManagerSelect users={users} employee={employee} /></div>
      <label className={styles.checkboxField}>
        <input name="active" type="checkbox" defaultChecked={employee?.active ?? true} />
        <span><strong>Active</strong><small>May be assigned to new orders.</small></span>
      </label>
    </div>
  );
}

export default async function PortalEmployeesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const q = firstParam(query.q)?.trim() ?? "";
  const status = statusValue(firstParam(query.status));
  const page = positivePage(firstParam(query.page));
  const historyPage = positivePage(firstParam(query.historyPage));
  const selectedEmployeeId = Number(firstParam(query.employee) ?? 0);
  const from = firstParam(query.from)?.trim() ?? "";
  const to = firstParam(query.to)?.trim() ?? "";
  const notice = firstParam(query.notice);
  const mutationError = firstParam(query.error);

  const [contextResult, administrationResult, configResult, employeesResult, spendResult] = await Promise.allSettled([
    getCompanyPortalContext(),
    getCompanyPortalAdministration(),
    getPortalEmployeeConfiguration(),
    getPortalEmployees({ currentPage: page, pageSize: PAGE_SIZE, search: q, active: activeFilter(status) }),
    getPortalEmployeeSpend({ from, to }),
  ]);

  if (contextResult.status === "rejected" || employeesResult.status === "rejected") {
    const reason = contextResult.status === "rejected"
      ? contextResult.reason
      : employeesResult.status === "rejected"
        ? employeesResult.reason
        : new Error("Employee workspace unavailable.");
    return <section className="card stack"><div><p className="eyebrow">Company portal</p><h1>Employees unavailable</h1></div><div className="error">{graphQLErrorMessage(reason)}</div></section>;
  }

  const context = contextResult.value;
  const administration = administrationResult.status === "fulfilled" ? administrationResult.value : null;
  const employees = employeesResult.value;
  const permissions = employeePermissions(administration);
  if (!permissions.canView) {
    return <section className="card stack"><div><p className="eyebrow">Company portal</p><h1>Employees unavailable</h1></div><div className="error">Your company role does not allow employee viewing.</div></section>;
  }

  const configuration = configResult.status === "fulfilled" ? configResult.value : null;
  const spend = spendResult.status === "fulfilled" ? spendResult.value : null;
  const spendError = spendResult.status === "rejected" ? graphQLErrorMessage(spendResult.reason) : null;
  const selectedMembership = context.companies.find((membership) => membership.selected);
  const spendByEmployee = new Map(spend?.items.map((item) => [item.employee_id, item]) ?? []);

  let selectedEmployee: CompanyEmployee | null = null;
  let orders = null;
  let orderError: string | null = null;
  if (Number.isInteger(selectedEmployeeId) && selectedEmployeeId > 0) {
    const visible = employees.items.find((employee) => employee.employee_id === selectedEmployeeId);
    const [employeeResult, ordersResult] = await Promise.allSettled([
      visible ? Promise.resolve(visible) : getPortalEmployee(selectedEmployeeId),
      getPortalEmployeeOrders({ employeeId: selectedEmployeeId, currentPage: historyPage, pageSize: ORDER_PAGE_SIZE, from, to }),
    ]);
    selectedEmployee = employeeResult.status === "fulfilled" ? employeeResult.value : null;
    orders = ordersResult.status === "fulfilled" ? ordersResult.value : null;
    if (employeeResult.status === "rejected") orderError = graphQLErrorMessage(employeeResult.reason);
    else if (ordersResult.status === "rejected") orderError = graphQLErrorMessage(ordersResult.reason);
  }

  const managers = administration?.users ?? [];
  const exportHref = `/api/portal/employees/export${status === "all" ? "" : `?active=${status === "active" ? "1" : "0"}`}`;

  return (
    <div className={styles.workspace}>
      <header className={styles.pageHeader}>
        <div>
          <p className="eyebrow">{selectedMembership?.reference || selectedMembership?.name || "Selected company"}</p>
          <h1>Employees</h1>
          <p>Keep the people used for company ordering organised, and review the product spend attributed to their orders.</p>
        </div>
        <div className={styles.headerBadge}>
          <span>Employee access</span>
          <strong>{permissions.canManage ? "Manage employees" : "View employees"}</strong>
        </div>
      </header>

      {notice ? <div className="notice">{notice}</div> : null}
      {mutationError ? <div className="error">{mutationError}</div> : null}

      <div className={styles.infoNote}>
        Employee records are ordering beneficiaries for reporting and allocation. They do not create Company Portal login accounts.
      </div>

      <section className={styles.topGrid} aria-label="Employee settings and data tools">
        <article className={`card ${styles.configurationCard}`}>
          <div><p className="eyebrow">Ordering setup</p><h2>Employee ordering</h2><p className="muted">Choose how employee beneficiaries are used when your company places orders.</p></div>
          {configuration ? permissions.canManage ? (
            <form action={savePortalEmployeeConfigurationAction} className="stack">
              <label className={styles.switchRow}><input name="usesEmployee" type="checkbox" defaultChecked={configuration.uses_employee} /><span><strong>Use employees</strong><small>Enable employee-aware ordering for this company.</small></span></label>
              <label className={styles.switchRow}><input name="multiEmployeeBasket" type="checkbox" defaultChecked={configuration.multi_employee_basket} /><span><strong>Multi-employee basket</strong><small>Allow one basket to contain items for more than one employee.</small></span></label>
              <div><button className="button" type="submit">Save ordering settings</button></div>
            </form>
          ) : (
            <dl>
              <div><dt>Employee ordering</dt><dd>{configuration.uses_employee ? "Enabled" : "Disabled"}</dd></div>
              <div><dt>Multi-employee basket</dt><dd>{configuration.multi_employee_basket ? "Enabled" : "Disabled"}</dd></div>
            </dl>
          ) : <div className="error">Employee configuration is unavailable.</div>}
        </article>

        <article className={`card ${styles.importCard}`}>
          <div><p className="eyebrow">Employee data</p><h2>Import &amp; export</h2><p className="muted">Download your employee data, or use the CSV template to maintain larger teams.</p></div>
          {permissions.canManage ? (
            <form action={importPortalEmployeesCsvAction} className="stack">
              <div className="field"><label htmlFor="portalEmployeeCsv">Employee CSV</label><input id="portalEmployeeCsv" name="employeeCsv" type="file" accept=".csv,text/csv" required /></div>
              <div className={styles.actionRow}><button className="button" type="submit">Import CSV</button><a className="button button-secondary button-link" href={exportHref}>Export CSV</a><a className="button button-secondary button-link" download="employee-import-template.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent(EMPLOYEE_IMPORT_TEMPLATE)}`}>Download template</a></div>
            </form>
          ) : <div><a className="button button-secondary button-link" href={exportHref}>Export CSV</a></div>}
        </article>
      </section>

      <section className={styles.reportingSection}>
        <div className={styles.sectionHeading}>
          <div><p className="eyebrow">Reporting</p><h2>Spend overview</h2><p className="muted">Product spend attributed to employee orders after line discounts and cancellations.</p></div>
          {spend ? <span className="badge badge-neutral">{spend.currency}</span> : null}
        </div>

        {spendError ? <div className="error">Reporting is not available: {spendError}</div> : null}
        {spend ? (
          <section className={styles.summaryGrid} aria-label="Employee spend summary">
            <article className={styles.metricCard}><span>Employees reported</span><strong>{spend.employee_count}</strong></article>
            <article className={styles.metricCard}><span>Attributed orders</span><strong>{spend.attributed_order_count}</strong></article>
            <article className={`${styles.metricCard} ${styles.metricPrimary}`}><span>Product spend</span><strong>{formatMoney(spend.product_spend, spend.currency)}</strong></article>
          </section>
        ) : null}

        <form className={`card ${styles.dateFilter}`} method="get">
          <input type="hidden" name="q" value={q} /><input type="hidden" name="status" value={status} />
          <div className="field"><label>From</label><input name="from" type="date" defaultValue={from} /></div>
          <div className="field"><label>To</label><input name="to" type="date" defaultValue={to} /></div>
          <button className="button button-secondary" type="submit">Apply dates</button>
          {from || to ? <Link className="button button-secondary button-link" href={withQuery({ q, status })}>Clear dates</Link> : null}
        </form>
      </section>

      <section className={styles.directorySection}>
        <div className={styles.sectionHeading}>
          <div><p className="eyebrow">People</p><h2>Employee directory</h2><p className="muted">{employees.total_count} employee{employees.total_count === 1 ? "" : "s"} match the current filters.</p></div>
          {permissions.canManage ? (
            <details className={styles.createPanel}>
              <summary><span><strong>Add employee</strong><small>Create an ordering beneficiary</small></span><span aria-hidden="true">＋</span></summary>
              <form action={createPortalEmployeeAction} className={styles.createForm}><EmployeeFields users={managers} /><div><button className="button" type="submit">Create employee</button></div></form>
            </details>
          ) : null}
        </div>

        <form className={`card ${styles.filterBar}`} method="get">
          <div className="field grow"><label>Find employee</label><input name="q" type="search" defaultValue={q} placeholder="Name, code, department or cost centre" /></div>
          <div className="field"><label>Status</label><select name="status" defaultValue={status}><option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All</option></select></div>
          <input type="hidden" name="from" value={from} /><input type="hidden" name="to" value={to} />
          <button className="button button-secondary" type="submit">Filter</button>
        </form>

        <div className={styles.employeeTable}>
          <div className={`${styles.employeeRow} ${styles.tableHeader}`} aria-hidden="true"><span>Employee</span><span>Department</span><span>Manager</span><span>Orders</span><span>Product spend</span><span>Status</span><span /></div>
          {employees.items.map((employee) => {
            const manager = managers.find((user) => user.user_id === employee.manager_company_user_id);
            const employeeSpend = spendByEmployee.get(employee.employee_id);
            return (
              <details className={styles.employeeRecord} key={employee.employee_id}>
                <summary className={styles.employeeRow}>
                  <span className={styles.identity}><strong>{employeeName(employee)}</strong><small>{employee.employee_code || `Employee #${employee.employee_id}`}</small></span>
                  <span>{employee.department || "—"}<small>{employee.cost_centre || ""}</small></span>
                  <span>{manager ? userName(manager) : "—"}</span>
                  <span>{employeeSpend?.order_count ?? "—"}</span>
                  <strong>{employeeSpend && spend ? formatMoney(employeeSpend.product_spend, spend.currency) : "—"}</strong>
                  <span><span className={employee.active ? "badge badge-ok" : "badge badge-neutral"}>{employee.active ? "Active" : "Inactive"}</span></span>
                  <span className={styles.manageLabel}>{permissions.canManage ? "Manage" : "Details"}</span>
                </summary>
                <div className={styles.recordBody}>
                  <div className={styles.recordHeading}>
                    <div><p className="eyebrow">Employee details</p><h3>{employeeName(employee)}</h3></div>
                    <Link className="button button-secondary button-link" href={withQuery({ q, status, from, to, page, employee: employee.employee_id })}>View order history</Link>
                  </div>
                  {permissions.canManage ? (
                    <>
                      <form action={updatePortalEmployeeAction} className="stack"><input type="hidden" name="employeeId" value={employee.employee_id} /><EmployeeFields users={managers} employee={employee} /><div><button className="button" type="submit">Save employee</button></div></form>
                      {employee.active ? <form action={deactivatePortalEmployeeAction} className={styles.deactivateRow}><input type="hidden" name="employeeId" value={employee.employee_id} /><div><strong>Deactivate employee</strong><p className="muted small-text">The employee is kept in historical reporting but cannot be assigned to new orders.</p></div><button className="button button-secondary" type="submit">Deactivate</button></form> : null}
                    </>
                  ) : <p className="muted">Your role has view-only employee access.</p>}
                </div>
              </details>
            );
          })}
          {!employees.items.length ? <div className={styles.emptyRow}>No employees match the current filters.</div> : null}
        </div>

        {employees.page_info.total_pages > 1 ? <div className={styles.pagination}>{page > 1 ? <Link className="button button-secondary button-link" href={withQuery({ q, status, from, to, page: page - 1 })}>Previous</Link> : <span />}<span>Page {employees.page_info.current_page} of {employees.page_info.total_pages}</span>{page < employees.page_info.total_pages ? <Link className="button button-secondary button-link" href={withQuery({ q, status, from, to, page: page + 1 })}>Next</Link> : <span />}</div> : null}
      </section>

      {selectedEmployee ? (
        <section className={`card ${styles.historyCard}`}>
          <div className={styles.sectionHeading}><div><p className="eyebrow">Order history</p><h2>{employeeName(selectedEmployee)}</h2><p className="muted">Orders attributed to this employee for the selected reporting period.</p></div><Link className="button button-secondary button-link" href={withQuery({ q, status, from, to, page })}>Close history</Link></div>
          {orderError ? <div className="error">{orderError}</div> : null}
          {orders ? <><div className={styles.historyMeta}><span>{orders.total_count} attributed order{orders.total_count === 1 ? "" : "s"}</span><span>{orders.currency}</span></div><div className={styles.orderTable}><div className={`${styles.orderRow} ${styles.tableHeader}`}><span>Order</span><span>Date</span><span>Status</span><span>Items</span><span>Product spend</span></div>{orders.items.map((order) => <div className={styles.orderRow} key={order.order_id}><strong>#{order.order_number}</strong><span>{formatDate(order.order_date)}</span><span>{order.status}</span><span>{order.item_count}</span><strong>{formatMoney(order.product_spend, orders.currency)}</strong></div>)}</div>{orders.page_info.total_pages > 1 ? <div className={styles.pagination}>{historyPage > 1 ? <Link className="button button-secondary button-link" href={withQuery({ q, status, from, to, page, employee: selectedEmployee.employee_id, historyPage: historyPage - 1 })}>Previous</Link> : <span />}<span>Page {orders.page_info.current_page} of {orders.page_info.total_pages}</span>{historyPage < orders.page_info.total_pages ? <Link className="button button-secondary button-link" href={withQuery({ q, status, from, to, page, employee: selectedEmployee.employee_id, historyPage: historyPage + 1 })}>Next</Link> : <span />}</div> : null}</> : null}
        </section>
      ) : selectedEmployeeId > 0 && orderError ? <div className="error">{orderError}</div> : null}
    </div>
  );
}
