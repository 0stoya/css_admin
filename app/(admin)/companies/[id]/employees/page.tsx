import Link from "next/link";
import { notFound } from "next/navigation";
import { History, UserMinus } from "lucide-react";
import { AdminActionModal, AdminFormFooter } from "@/components/admin-action-modal";
import { getCompany } from "@/lib/graphql/companies";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import { EMPLOYEE_IMPORT_TEMPLATE } from "@/lib/company-employees-csv";
import { getCompanyManagement, type CompanyAdminUser } from "@/lib/graphql/company-management";
import {
  getCompanyEmployee,
  getCompanyEmployeeConfiguration,
  getCompanyEmployeeOrders,
  getCompanyEmployees,
  getCompanyEmployeeSpend,
  type CompanyEmployee,
  type CompanyEmployeeOrderSearchResult,
  type CompanyEmployeeSpendResult,
} from "@/lib/graphql/company-employees";
import {
  createEmployeeAction,
  deactivateEmployeeAction,
  importEmployeesCsvAction,
  saveEmployeeConfigurationAction,
  updateEmployeeAction,
} from "./actions";
import styles from "@/components/company-employees-workspace.module.css";

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

function statusFilter(value: EmployeeStatus) {
  if (value === "all") return undefined;
  return value === "active";
}

function employeeName(employee: Pick<CompanyEmployee, "full_name" | "first_name" | "last_name">) {
  return employee.full_name.trim() || `${employee.first_name} ${employee.last_name}`.trim();
}

function userName(user: Pick<CompanyAdminUser, "firstname" | "lastname" | "email">) {
  return `${user.firstname} ${user.lastname}`.trim() || user.email;
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
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

function withQuery(companyId: number, values: Record<string, string | number | null | undefined>) {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== null && value !== undefined && String(value) !== "") query.set(key, String(value));
  });
  const suffix = query.toString();
  return `/companies/${companyId}/employees${suffix ? `?${suffix}` : ""}`;
}

function ManagerSelect({
  users,
  defaultValue,
  id,
}: {
  users: CompanyAdminUser[];
  defaultValue?: number | null;
  id: string;
}) {
  return (
    <select id={id} name="managerCompanyUserId" defaultValue={defaultValue ?? ""}>
      <option value="">No manager</option>
      {users.map((user) => (
        <option key={user.user_id} value={user.user_id}>{userName(user)} · #{user.user_id}</option>
      ))}
    </select>
  );
}

function EmployeeFields({ employee, managers }: { employee?: CompanyEmployee; managers: CompanyAdminUser[] }) {
  const prefix = employee ? `employee-${employee.employee_id}` : "new-employee";
  return (
    <div className={styles.formGrid}>
      <div className="field">
        <label htmlFor={`${prefix}-first-name`}>First name</label>
        <input id={`${prefix}-first-name`} name="firstName" defaultValue={employee?.first_name ?? ""} required />
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-last-name`}>Last name</label>
        <input id={`${prefix}-last-name`} name="lastName" defaultValue={employee?.last_name ?? ""} required />
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-code`}>Employee code</label>
        <input id={`${prefix}-code`} name="employeeCode" defaultValue={employee?.employee_code ?? ""} placeholder="Optional" />
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-department`}>Department</label>
        <input id={`${prefix}-department`} name="department" defaultValue={employee?.department ?? ""} />
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-cost-centre`}>Cost centre</label>
        <input id={`${prefix}-cost-centre`} name="costCentre" defaultValue={employee?.cost_centre ?? ""} />
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-manager`}>Manager</label>
        <ManagerSelect id={`${prefix}-manager`} users={managers} defaultValue={employee?.manager_company_user_id} />
      </div>
      <label className={styles.checkboxField} htmlFor={`${prefix}-active`}>
        <input id={`${prefix}-active`} name="active" type="checkbox" defaultChecked={employee?.active ?? true} />
        <span><strong>Active</strong><small>Active employees can be assigned to new basket lines.</small></span>
      </label>
    </div>
  );
}

function EmployeeReturnState({
  modal,
  q,
  status,
  from,
  to,
  page,
}: {
  modal: string;
  q: string;
  status: EmployeeStatus;
  from: string;
  to: string;
  page: number;
}) {
  return (
    <>
      <input type="hidden" name="returnModal" value={modal} />
      <input type="hidden" name="returnQ" value={q} />
      <input type="hidden" name="returnStatus" value={status} />
      <input type="hidden" name="returnFrom" value={from} />
      <input type="hidden" name="returnTo" value={to} />
      <input type="hidden" name="returnPage" value={page} />
    </>
  );
}

function ReportingSummary({ report }: { report: CompanyEmployeeSpendResult | null }) {
  if (!report) return null;
  return (
    <section className={styles.summaryGrid} aria-label="Employee reporting summary">
      <article className={styles.metricCard}>
        <span>Employees reported</span><strong>{report.employee_count}</strong><small>Includes inactive employees with history</small>
      </article>
      <article className={styles.metricCard}>
        <span>Attributed orders</span><strong>{report.attributed_order_count}</strong><small>Orders containing employee-attributed lines</small>
      </article>
      <article className={`${styles.metricCard} ${styles.metricPrimary}`}>
        <span>Product spend</span><strong>{formatMoney(report.product_spend, report.currency)}</strong><small>After line discounts and cancellations</small>
      </article>
    </section>
  );
}

function OrderHistory({
  employee,
  orders,
  error,
  companyId,
  query,
}: {
  employee: CompanyEmployee;
  orders: CompanyEmployeeOrderSearchResult | null;
  error: string | null;
  companyId: number;
  query: { q: string; status: EmployeeStatus; from: string; to: string; page: number; historyPage: number };
}) {
  return (
    <section className={`card ${styles.historyCard}`} id="employee-history">
      <div className={styles.sectionHeading}>
        <div>
          <p className="eyebrow">Employee history</p>
          <h2>{employeeName(employee)}</h2>
          <p className="muted">{employee.employee_code || `Employee #${employee.employee_id}`} · immutable order attribution</p>
        </div>
        <Link className="button button-secondary button-link" href={withQuery(companyId, {
          q: query.q,
          status: query.status,
          from: query.from,
          to: query.to,
          page: query.page,
        })}>Close history</Link>
      </div>

      {error ? <div className="error">{error}</div> : null}
      {orders ? (
        <>
          <div className={styles.historyMeta}>
            <span>{orders.total_count} order{orders.total_count === 1 ? "" : "s"}</span>
            <span className="badge badge-neutral">{orders.metric.replaceAll("_", " ").toLowerCase()}</span>
          </div>
          <div className={styles.orderTable}>
            <div className={`${styles.orderRow} ${styles.tableHeader}`} aria-hidden="true">
              <span>Order</span><span>Date</span><span>Status</span><span>Items</span><span>Product spend</span>
            </div>
            {orders.items.map((order) => (
              <div className={styles.orderRow} key={order.order_id}>
                <strong>#{order.order_number}</strong>
                <span>{formatDate(order.order_date)}</span>
                <span><span className="badge badge-neutral">{order.status}</span></span>
                <span>{order.item_count}</span>
                <strong>{formatMoney(order.product_spend, orders.currency)}</strong>
              </div>
            ))}
            {!orders.items.length ? <div className={styles.emptyRow}>No attributed orders in this date range.</div> : null}
          </div>
          {orders.page_info.total_pages > 1 ? (
            <div className={styles.pagination}>
              {query.historyPage > 1 ? (
                <Link className="button button-secondary button-link" href={`${withQuery(companyId, {
                  q: query.q, status: query.status, from: query.from, to: query.to, page: query.page,
                  employee: employee.employee_id, historyPage: query.historyPage - 1,
                })}#employee-history`}>Previous</Link>
              ) : <span />}
              <span>Page {orders.page_info.current_page} of {orders.page_info.total_pages}</span>
              {query.historyPage < orders.page_info.total_pages ? (
                <Link className="button button-secondary button-link" href={`${withQuery(companyId, {
                  q: query.q, status: query.status, from: query.from, to: query.to, page: query.page,
                  employee: employee.employee_id, historyPage: query.historyPage + 1,
                })}#employee-history`}>Next</Link>
              ) : <span />}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export default async function CompanyEmployeesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const paramsValue = await searchParams;
  const companyId = Number(id);
  if (!Number.isInteger(companyId) || companyId <= 0) notFound();

  const q = firstParam(paramsValue.q)?.trim() ?? "";
  const status = statusValue(firstParam(paramsValue.status));
  const page = positivePage(firstParam(paramsValue.page));
  const historyPage = positivePage(firstParam(paramsValue.historyPage));
  const selectedEmployeeId = Number(firstParam(paramsValue.employee) ?? 0);
  const from = firstParam(paramsValue.from)?.trim() ?? "";
  const to = firstParam(paramsValue.to)?.trim() ?? "";
  const modal = firstParam(paramsValue.modal)?.trim() ?? "";
  const notice = firstParam(paramsValue.notice);
  const mutationError = firstParam(paramsValue.error);
  const modalStateKey = [modal, q, status, from, to, String(page), notice ?? "", mutationError ?? ""].join("|");

  const [companyResult, configResult, employeesResult, managementResult, spendResult] = await Promise.allSettled([
    getCompany(companyId),
    getCompanyEmployeeConfiguration(companyId),
    getCompanyEmployees({ companyId, currentPage: page, pageSize: PAGE_SIZE, search: q, active: statusFilter(status) }),
    getCompanyManagement(companyId),
    getCompanyEmployeeSpend({ companyId, from, to }),
  ]);

  const company = companyResult.status === "fulfilled" ? companyResult.value : null;
  const configuration = configResult.status === "fulfilled" ? configResult.value : null;
  const employees = employeesResult.status === "fulfilled" ? employeesResult.value : null;
  const management = managementResult.status === "fulfilled" ? managementResult.value : null;
  const spend = spendResult.status === "fulfilled" ? spendResult.value : null;
  const reportingError = spendResult.status === "rejected" ? graphQLErrorMessage(spendResult.reason) : null;

  if (!company || !employees) {
    const error = companyResult.status === "rejected"
      ? graphQLErrorMessage(companyResult.reason)
      : employeesResult.status === "rejected"
        ? graphQLErrorMessage(employeesResult.reason)
        : "Employee data is unavailable.";
    return (
      <div className="stack">
        <section className="card stack">
          <div><p className="eyebrow">Backend request failed</p><h1>Employees unavailable</h1></div>
          <div className="error">{error}</div>
        </section>
      </div>
    );
  }

  const managers = management?.users ?? [];
  const spendByEmployee = new Map(spend?.items.map((item) => [item.employee_id, item]) ?? []);
  let selectedEmployee: CompanyEmployee | null = null;
  let orders: CompanyEmployeeOrderSearchResult | null = null;
  let orderError: string | null = null;

  if (Number.isInteger(selectedEmployeeId) && selectedEmployeeId > 0) {
    const visible = employees.items.find((employee) => employee.employee_id === selectedEmployeeId) ?? null;
    const [employeeResult, ordersResult] = await Promise.allSettled([
      visible ? Promise.resolve(visible) : getCompanyEmployee(companyId, selectedEmployeeId),
      getCompanyEmployeeOrders({
        companyId,
        employeeId: selectedEmployeeId,
        currentPage: historyPage,
        pageSize: ORDER_PAGE_SIZE,
        from,
        to,
      }),
    ]);
    selectedEmployee = employeeResult.status === "fulfilled" ? employeeResult.value : null;
    orders = ordersResult.status === "fulfilled" ? ordersResult.value : null;
    if (employeeResult.status === "rejected") orderError = graphQLErrorMessage(employeeResult.reason);
    else if (ordersResult.status === "rejected") orderError = graphQLErrorMessage(ordersResult.reason);
  }

  const exportHref = `/api/companies/${companyId}/employees/export${status === "all" ? "" : `?active=${status === "active" ? "1" : "0"}`}`;

  return (
    <div className={styles.workspace}>
      <header className="page-header">
        <div>
          <p className="eyebrow">{company.reference || `Company ${company.company_id}`}</p>
          <h1>Employees</h1>
          <p className="muted">Manage non-login staff beneficiaries, ordering rules and employee-attributed product spend.</p>
        </div>
        <span className="badge badge-neutral">No Magento logins</span>
      </header>

      {notice ? <div className="notice">{notice}</div> : null}
      {mutationError && !modal ? <div className="error">{mutationError}</div> : null}

      <section className={styles.topGrid}>
        <article className={`card ${styles.configurationCard}`}>
          <div>
            <p className="eyebrow">Ordering behaviour</p>
            <h2>Employee ordering</h2>
            <p className="muted">Controls whether buyers can order for staff and whether one basket may contain multiple employees.</p>
          </div>
          {configuration ? (
            <form action={saveEmployeeConfigurationAction} className="stack">
              <input type="hidden" name="companyId" value={companyId} />
              <label className={styles.switchRow}>
                <input type="checkbox" name="usesEmployee" defaultChecked={configuration.uses_employee} />
                <span><strong>Uses employees</strong><small>Enable canonical employee assignment during ordering.</small></span>
              </label>
              <label className={styles.switchRow}>
                <input type="checkbox" name="multiEmployeeBasket" defaultChecked={configuration.multi_employee_basket} />
                <span><strong>Multi-employee basket</strong><small>Allow different basket lines to be assigned to different employees.</small></span>
              </label>
              <div><button className="button" type="submit">Save ordering settings</button></div>
            </form>
          ) : (
            <div className="error">{configResult.status === "rejected" ? graphQLErrorMessage(configResult.reason) : "Configuration unavailable."}</div>
          )}
        </article>

        <article className={`card ${styles.importCard}`}>
          <div>
            <p className="eyebrow">Structured CSV</p>
            <h2>Import / export</h2>
            <p className="muted">Import creates or updates employees by non-empty employee code. Export always uses the backend’s canonical fields.</p>
          </div>
          <form action={importEmployeesCsvAction} className="stack">
            <input type="hidden" name="companyId" value={companyId} />
            <div className="field">
              <label htmlFor="employeeCsv">Employee CSV</label>
              <input id="employeeCsv" name="employeeCsv" type="file" accept=".csv,text/csv" required />
            </div>
            <div className={styles.actionRow}>
              <button className="button" type="submit">Import CSV</button>
              <a className="button button-secondary button-link" href={exportHref}>Export {status === "all" ? "all" : status} employees</a>
              <a className="button button-secondary button-link" download="employee-import-template.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent(EMPLOYEE_IMPORT_TEMPLATE)}`}>Template</a>
            </div>
          </form>
        </article>
      </section>

      <section className={styles.reportingSection}>
        <div className={styles.sectionHeading}>
          <div>
            <p className="eyebrow">Reporting</p>
            <h2>Employee product spend</h2>
            <p className="muted">Ordered product value after line discounts and cancellations. Shipping and refunds are not included in this metric.</p>
          </div>
          {spend ? <span className="badge badge-neutral">{spend.currency}</span> : null}
        </div>
        <form className={`card ${styles.dateFilter}`} method="get">
          <input type="hidden" name="q" value={q} />
          <input type="hidden" name="status" value={status} />
          <div className="field"><label htmlFor="from">From</label><input id="from" name="from" type="date" defaultValue={from} /></div>
          <div className="field"><label htmlFor="to">To</label><input id="to" name="to" type="date" defaultValue={to} /></div>
          <button className="button button-secondary" type="submit">Apply dates</button>
          {from || to ? <Link className="button button-secondary button-link" href={withQuery(companyId, { q, status })}>Clear dates</Link> : null}
        </form>
        {reportingError ? <div className="error">Reporting is not available: {reportingError}</div> : null}
        <ReportingSummary report={spend} />
      </section>

      <section className={styles.directorySection}>
        <div className={styles.sectionHeading}>
          <div><p className="eyebrow">Beneficiary directory</p><h2>Company employees</h2><p className="muted">{employees.total_count} employee{employees.total_count === 1 ? "" : "s"} match the current filters.</p></div>
          <AdminActionModal
            title="Add employee"
            description="Create a non-login beneficiary record for ordering and employee-attributed reporting."
            triggerLabel="Add employee"
            triggerIcon="plus"
            triggerVariant="primary"
            defaultOpen={modal === "add-employee"}
            stateKey={modalStateKey}
            wide
          >
            {mutationError && modal === "add-employee" ? <div className="error" role="alert">{mutationError}</div> : null}
            <form action={createEmployeeAction} className="admin-employee-modal-form">
              <input type="hidden" name="companyId" value={companyId} />
              <EmployeeReturnState modal="add-employee" q={q} status={status} from={from} to={to} page={page} />
              <EmployeeFields managers={managers} />
              <AdminFormFooter submitLabel="Create employee" pendingLabel="Creating employee…" />
            </form>
          </AdminActionModal>
        </div>

        <form className={`card ${styles.filterBar}`} method="get">
          <div className="field grow">
            <label htmlFor="q">Find employee</label>
            <input id="q" name="q" type="search" defaultValue={q} placeholder="Name, code, department or cost centre" />
          </div>
          <div className="field">
            <label htmlFor="status">Status</label>
            <select id="status" name="status" defaultValue={status}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
          </div>
          <input type="hidden" name="from" value={from} />
          <input type="hidden" name="to" value={to} />
          <button className="button button-secondary" type="submit">Filter</button>
          {q || status !== "active" ? <Link className="button button-secondary button-link" href={withQuery(companyId, { from, to })}>Clear</Link> : null}
        </form>

        <div className={styles.employeeTable}>
          <div className={`${styles.employeeRow} ${styles.tableHeader}`} aria-hidden="true">
            <span>Employee</span><span>Department</span><span>Manager</span><span>Orders</span><span>Product spend</span><span>Status</span><span />
          </div>
          {employees.items.map((employee) => {
            const manager = managers.find((user) => user.user_id === employee.manager_company_user_id);
            const employeeSpend = spendByEmployee.get(employee.employee_id);
            const modalKey = `edit-employee-${employee.employee_id}`;
            const historyHref = `${withQuery(companyId, {
              q, status, from, to, page,
              employee: employee.employee_id,
            })}#employee-history`;
            return (
              <div className={`${styles.employeeRecord} admin-employee-record`} key={employee.employee_id}>
                <div className={`${styles.employeeRow} admin-employee-row`}>
                  <span className={styles.identity}><strong>{employeeName(employee)}</strong><small>{employee.employee_code || `Employee #${employee.employee_id}`}</small></span>
                  <span>{employee.department || "—"}<small>{employee.cost_centre || ""}</small></span>
                  <span>{manager ? userName(manager) : employee.manager_company_user_id ? `User #${employee.manager_company_user_id}` : "—"}</span>
                  <span>{employeeSpend?.order_count ?? "—"}</span>
                  <strong>{employeeSpend && spend ? formatMoney(employeeSpend.product_spend, spend.currency) : "—"}</strong>
                  <span><span className={employee.active ? "badge badge-ok" : "badge badge-neutral"}>{employee.active ? "Active" : "Inactive"}</span></span>
                  <div className="admin-employee-row-actions">
                    <AdminActionModal
                      title={`Edit ${employeeName(employee)}`}
                      description={`${employee.employee_code || `Employee #${employee.employee_id}`} · beneficiary record, not a Magento login.`}
                      triggerLabel="Edit"
                      triggerIcon="edit"
                      defaultOpen={modal === modalKey}
                      stateKey={modalStateKey}
                      wide
                    >
                      {mutationError && modal === modalKey ? <div className="error" role="alert">{mutationError}</div> : null}
                      <form action={updateEmployeeAction} className="admin-employee-modal-form">
                        <input type="hidden" name="companyId" value={companyId} />
                        <input type="hidden" name="employeeId" value={employee.employee_id} />
                        <EmployeeReturnState modal={modalKey} q={q} status={status} from={from} to={to} page={page} />
                        <EmployeeFields employee={employee} managers={managers} />
                        <AdminFormFooter submitLabel="Save employee" pendingLabel="Saving employee…" />
                      </form>
                      {employee.active ? (
                        <details className="admin-employee-danger">
                          <summary><UserMinus size={16} aria-hidden="true" />Deactivate employee</summary>
                          <form action={deactivateEmployeeAction} className="admin-employee-danger-form">
                            <input type="hidden" name="companyId" value={companyId} />
                            <input type="hidden" name="employeeId" value={employee.employee_id} />
                            <EmployeeReturnState modal={modalKey} q={q} status={status} from={from} to={to} page={page} />
                            <p className="muted small-text">Stops new basket assignment while preserving immutable order history and reporting.</p>
                            <button className="button button-secondary" type="submit">Deactivate employee</button>
                          </form>
                        </details>
                      ) : null}
                    </AdminActionModal>
                    <Link className="admin-employee-history-link" href={historyHref}>
                      <History size={16} aria-hidden="true" />
                      <span>History</span>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
          {!employees.items.length ? <div className={styles.emptyRow}>No employees match the current filters.</div> : null}
        </div>

        {employees.page_info.total_pages > 1 ? (
          <div className={styles.pagination}>
            {page > 1 ? <Link className="button button-secondary button-link" href={withQuery(companyId, { q, status, from, to, page: page - 1 })}>Previous</Link> : <span />}
            <span>Page {employees.page_info.current_page} of {employees.page_info.total_pages}</span>
            {page < employees.page_info.total_pages ? <Link className="button button-secondary button-link" href={withQuery(companyId, { q, status, from, to, page: page + 1 })}>Next</Link> : <span />}
          </div>
        ) : null}
      </section>

      {selectedEmployee ? (
        <OrderHistory
          employee={selectedEmployee}
          orders={orders}
          error={orderError}
          companyId={companyId}
          query={{ q, status, from, to, page, historyPage }}
        />
      ) : selectedEmployeeId > 0 && orderError ? <div className="error">{orderError}</div> : null}
    </div>
  );
}
