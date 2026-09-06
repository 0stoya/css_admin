import Link from "next/link";
import { notFound } from "next/navigation";
import { PurchaseRuleEditor } from "@/components/purchase-rule-editor";
import { getCompany } from "@/lib/graphql/companies";
import { getCompanyManagement } from "@/lib/graphql/company-management";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import {
  getAppliedPurchaseControls,
  getPurchaseControlHistory,
  getPurchaseControls,
} from "@/lib/graphql/purchase-controls";
import {
  applyPurchaseControlTemplateAction,
  assignPurchaseControlTemplateAction,
  deletePurchaseControlTemplateAction,
  resetPurchaseControlCountersAction,
  savePurchaseControlTemplateAction,
} from "./actions";

type PurchaseControlsView = "templates" | "assignments" | "allowances" | "history";

type SearchQuery = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function viewParam(value: string | undefined): PurchaseControlsView {
  return value === "assignments" || value === "allowances" || value === "history"
    ? value
    : "templates";
}

function positiveQueryInt(value: string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function purchaseControlsHref(
  companyId: number,
  params: Record<string, string | number | null | undefined>,
) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && String(value) !== "") {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return `/companies/${companyId}/purchase-controls${query ? `?${query}` : ""}`;
}

function ChevronRightIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(date);
}

async function loadPurchaseControls(
  companyId: number,
  appliedSearch: string,
  historySearch: string,
) {
  try {
    const [company, management, controls, applied, history] = await Promise.all([
      getCompany(companyId),
      getCompanyManagement(companyId),
      getPurchaseControls(companyId),
      getAppliedPurchaseControls(companyId, 1, 50, appliedSearch),
      getPurchaseControlHistory(companyId, 1, 50, historySearch),
    ]);

    return { company, management, controls, applied, history, error: null };
  } catch (error) {
    return {
      company: null,
      management: null,
      controls: null,
      applied: null,
      history: null,
      error: graphQLErrorMessage(error),
    };
  }
}

export default async function PurchaseControlsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchQuery>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const companyId = Number(id);

  if (!Number.isInteger(companyId) || companyId <= 0) notFound();

  const view = viewParam(firstParam(query.view));
  const templateSearch = firstParam(query.templateSearch)?.trim() ?? "";
  const roleSearch = firstParam(query.roleSearch)?.trim() ?? "";
  const appliedSearch = firstParam(query.appliedSearch)?.trim() ?? "";
  const historySearch = firstParam(query.historySearch)?.trim() ?? "";
  const selectedTemplateId = positiveQueryInt(firstParam(query.templateId));
  const selectedRoleId = positiveQueryInt(firstParam(query.roleId));
  const creatingTemplate = firstParam(query.create) === "1";
  const notice = firstParam(query.notice);
  const mutationError = firstParam(query.error);

  const { company, management, controls, applied, history, error } = await loadPurchaseControls(
    companyId,
    appliedSearch,
    historySearch,
  );

  if (!company || !management || !controls || !applied || !history) {
    return (
      <div className="stack">
        <div><Link className="back-link" href={`/companies/${companyId}`}>← Company overview</Link></div>
        <section className="card stack">
          <div>
            <p className="eyebrow">Backend request failed</p>
            <h1>Purchase controls unavailable</h1>
          </div>
          <div className="error">{error}</div>
        </section>
      </div>
    );
  }

  const assignedTemplateByRole = new Map<number, (typeof controls.templates)[number]>();
  controls.templates.forEach((template) => {
    template.assigned_roles.forEach((role) => {
      assignedTemplateByRole.set(role.role_id, template);
    });
  });

  const assignedRoleCount = assignedTemplateByRole.size;
  const selectedTemplate = selectedTemplateId
    ? controls.templates.find((template) => template.template_id === selectedTemplateId) ?? null
    : null;
  const selectedRole = selectedRoleId
    ? management.roles.find((role) => role.role_id === selectedRoleId) ?? null
    : null;
  const selectedRoleTemplate = selectedRole
    ? assignedTemplateByRole.get(selectedRole.role_id) ?? null
    : null;

  const normalisedTemplateSearch = templateSearch.toLocaleLowerCase("en");
  const visibleTemplates = controls.templates.filter((template) => {
    if (!normalisedTemplateSearch) return true;
    return [
      template.name,
      ...template.assigned_roles.map((role) => role.role_name),
      ...template.rules.flatMap((rule) => [rule.sku, rule.product_name]),
    ].some((value) => value.toLocaleLowerCase("en").includes(normalisedTemplateSearch));
  });

  const normalisedRoleSearch = roleSearch.toLocaleLowerCase("en");
  const visibleRoles = management.roles.filter((role) => {
    if (!normalisedRoleSearch) return true;
    const assignment = assignedTemplateByRole.get(role.role_id);
    return [role.name, assignment?.name ?? ""].some((value) =>
      value.toLocaleLowerCase("en").includes(normalisedRoleSearch),
    );
  });

  const tabItems: Array<{ view: PurchaseControlsView; label: string; count: number }> = [
    { view: "templates", label: "Templates", count: controls.templates.length },
    { view: "assignments", label: "Assignments", count: assignedRoleCount },
    { view: "allowances", label: "Allowances", count: applied.total_count },
    { view: "history", label: "History", count: history.total_count },
  ];

  return (
    <div className="purchase-workspace">
      <header className="page-header">
        <div>
          <p className="eyebrow">Purchase limits</p>
          <h1>Purchase controls</h1>
          <p className="muted">
            Build reusable SKU allowances, assign them to company roles and review actual usage.
          </p>
        </div>
      </header>

      {notice ? <div className="success">{notice}</div> : null}
      {mutationError ? <div className="error">{mutationError}</div> : null}

      <nav className="purchase-workspace-tabs" aria-label="Purchase control workspace">
        {tabItems.map((item) => (
          <Link
            key={item.view}
            href={purchaseControlsHref(companyId, { view: item.view })}
            aria-current={view === item.view ? "page" : undefined}
          >
            {item.label}
            <span className="purchase-tab-count">{item.count}</span>
          </Link>
        ))}
      </nav>

      {view === "templates" ? (
        <section className="stack">
          <div className="purchase-section-heading">
            <div>
              <p className="eyebrow">Templates</p>
              <h2>Purchase-control templates</h2>
              <p className="muted">
                Each template is a reusable set of SKU quantity and time-window rules.
              </p>
            </div>
            <div className="purchase-heading-actions">
              {!creatingTemplate ? (
                <Link
                  className="button icon-button-label"
                  href={purchaseControlsHref(companyId, { view: "templates", create: 1 })}
                >
                  <PlusIcon />
                  Create template
                </Link>
              ) : null}
            </div>
          </div>

          {creatingTemplate ? (
            <section className="card purchase-template-workspace">
              <div className="purchase-template-heading">
                <div>
                  <p className="eyebrow">New template</p>
                  <h2>Create purchase-control template</h2>
                  <p className="muted">
                    Add only the products that need a quantity or time-window allowance.
                  </p>
                </div>
                <Link
                  className="button button-secondary"
                  href={purchaseControlsHref(companyId, { view: "templates" })}
                >
                  Cancel
                </Link>
              </div>
              <div className="purchase-template-content">
                <form className="stack" action={savePurchaseControlTemplateAction}>
                  <input type="hidden" name="companyId" value={companyId} />
                  <div className="field">
                    <label htmlFor="new-purchase-template-name">Template name</label>
                    <input
                      id="new-purchase-template-name"
                      name="name"
                      required
                      placeholder="e.g. Monthly PPE allowance"
                    />
                  </div>
                  <PurchaseRuleEditor label="Product rules" />
                  <div>
                    <button className="button" type="submit">Create template</button>
                  </div>
                </form>
              </div>
            </section>
          ) : null}

          <form className="card purchase-filter-card" method="get">
            <input type="hidden" name="view" value="templates" />
            <div className="field">
              <label htmlFor="templateSearch">Find a template</label>
              <input
                id="templateSearch"
                name="templateSearch"
                defaultValue={templateSearch}
                placeholder="Template, role, SKU or product"
              />
            </div>
            <button className="button button-secondary" type="submit">Search</button>
          </form>

          {visibleTemplates.length ? (
            <div className="card purchase-list-card table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Template</th>
                    <th>Rules</th>
                    <th>Roles</th>
                    <th>Status</th>
                    <th aria-label="Action" />
                  </tr>
                </thead>
                <tbody>
                  {visibleTemplates.map((template) => {
                    const selected = selectedTemplate?.template_id === template.template_id;
                    return (
                      <tr key={template.template_id} className={selected ? "purchase-active-row" : undefined}>
                        <td>
                          <div className="purchase-name-cell">
                            <strong>{template.name}</strong>
                            <small>Template #{template.template_id}</small>
                          </div>
                        </td>
                        <td>{template.rules.length}</td>
                        <td>{template.assigned_roles.length}</td>
                        <td>
                          <span className={`badge ${template.assigned_roles.length ? "badge-ok" : "badge-neutral"}`}>
                            {template.assigned_roles.length ? "Assigned" : "Unassigned"}
                          </span>
                        </td>
                        <td>
                          <Link
                            className="purchase-open-link"
                            href={purchaseControlsHref(companyId, {
                              view: "templates",
                              templateId: template.template_id,
                              templateSearch,
                            })}
                          >
                            {selected ? "Open" : "Manage"}
                            <ChevronRightIcon />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="purchase-empty-state">
              <strong>{controls.templates.length ? "No templates match this search" : "No templates configured"}</strong>
              <span className="muted small-text">
                {controls.templates.length
                  ? "Try a template name, assigned role, SKU or product name."
                  : "Create a template when this company needs product purchase limits."}
              </span>
            </div>
          )}

          {selectedTemplate && !creatingTemplate ? (
            <section className="card purchase-template-workspace">
              <div className="purchase-template-heading">
                <div>
                  <p className="eyebrow">Selected template</p>
                  <h2>{selectedTemplate.name}</h2>
                  <p className="muted">Template #{selectedTemplate.template_id}</p>
                </div>
                <div className="purchase-heading-actions">
                  <span className={`badge ${selectedTemplate.assigned_roles.length ? "badge-ok" : "badge-neutral"}`}>
                    {selectedTemplate.assigned_roles.length ? "Assigned" : "Unassigned"}
                  </span>
                  <Link
                    className="button button-secondary"
                    href={purchaseControlsHref(companyId, { view: "templates", templateSearch })}
                  >
                    Close
                  </Link>
                </div>
              </div>

              <div className="purchase-summary-strip">
                <div className="purchase-summary-item">
                  <span>Rules</span>
                  <strong>{selectedTemplate.rules.length}</strong>
                </div>
                <div className="purchase-summary-item">
                  <span>Products</span>
                  <strong>{new Set(selectedTemplate.rules.map((rule) => rule.sku)).size}</strong>
                </div>
                <div className="purchase-summary-item">
                  <span>Assigned roles</span>
                  <strong>{selectedTemplate.assigned_roles.length}</strong>
                </div>
              </div>

              <div className="purchase-template-content">
                {selectedTemplate.assigned_roles.length ? (
                  <div className="purchase-role-badges" aria-label="Assigned roles">
                    {selectedTemplate.assigned_roles.map((role) => (
                      <span className="purchase-role-badge" key={role.role_id}>{role.role_name}</span>
                    ))}
                  </div>
                ) : (
                  <p className="muted">This template is not assigned to a role yet.</p>
                )}

                <div className="table-wrap purchase-rule-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>SKU</th>
                        <th>Limit</th>
                        <th>Window</th>
                        <th>Starts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTemplate.rules.length ? selectedTemplate.rules.map((rule) => (
                        <tr key={rule.rule_id}>
                          <td><strong>{rule.product_name}</strong></td>
                          <td><code>{rule.sku}</code></td>
                          <td>{rule.quantity_limit}</td>
                          <td>{rule.duration_days} days</td>
                          <td>{rule.start_date}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={5}>No product rules in this template.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <details className="purchase-editor-panel">
                  <summary>
                    <span>
                      <strong>Edit template</strong>
                      <small className="muted">Change the name or product rule rows.</small>
                    </span>
                  </summary>
                  <form className="purchase-editor-body" action={savePurchaseControlTemplateAction}>
                    <input type="hidden" name="companyId" value={companyId} />
                    <input type="hidden" name="templateId" value={selectedTemplate.template_id} />
                    <div className="field">
                      <label htmlFor={`template-name-${selectedTemplate.template_id}`}>Template name</label>
                      <input
                        id={`template-name-${selectedTemplate.template_id}`}
                        name="name"
                        required
                        defaultValue={selectedTemplate.name}
                      />
                    </div>
                    <PurchaseRuleEditor initialRules={selectedTemplate.rules} label="Product rules" />
                    <div><button className="button" type="submit">Save template</button></div>
                  </form>
                </details>

                <div>
                  <p className="eyebrow">Operations</p>
                  <div className="purchase-operation-grid">
                    <form className="purchase-operation-card" action={applyPurchaseControlTemplateAction}>
                      <input type="hidden" name="companyId" value={companyId} />
                      <input type="hidden" name="templateId" value={selectedTemplate.template_id} />
                      <div>
                        <strong>Apply to assigned users</strong>
                        <p className="muted small-text">
                          Replace eligible users&apos; current allowances with this template.
                        </p>
                      </div>
                      <label className="purchase-check-field">
                        <input type="checkbox" name="confirmApply" value="yes" required />
                        <span>
                          <strong>Confirm overwrite</strong>
                          <span className="muted small-text">Required before applying.</span>
                        </span>
                      </label>
                      <div>
                        <button className="button" type="submit" disabled={!selectedTemplate.assigned_roles.length}>
                          Apply to users
                        </button>
                      </div>
                    </form>

                    <form className="purchase-operation-card" action={resetPurchaseControlCountersAction}>
                      <input type="hidden" name="companyId" value={companyId} />
                      <input type="hidden" name="templateId" value={selectedTemplate.template_id} />
                      <div>
                        <strong>Reset consumed counters</strong>
                        <p className="muted small-text">
                          Clear usage counters for users currently governed by this template.
                        </p>
                      </div>
                      <label className="purchase-check-field">
                        <input type="checkbox" name="confirmReset" value="yes" required />
                        <span>
                          <strong>Confirm reset</strong>
                          <span className="muted small-text">Required before clearing counters.</span>
                        </span>
                      </label>
                      <div>
                        <button className="button button-secondary" type="submit" disabled={!selectedTemplate.assigned_roles.length}>
                          Reset counters
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                <details className="purchase-operation-panel purchase-danger-panel">
                  <summary>
                    <span>
                      <strong>Delete template</strong>
                      <small>Only unassigned templates can be deleted.</small>
                    </span>
                  </summary>
                  <form className="purchase-operation-body" action={deletePurchaseControlTemplateAction}>
                    <input type="hidden" name="companyId" value={companyId} />
                    <input type="hidden" name="templateId" value={selectedTemplate.template_id} />
                    <div className="field">
                      <label htmlFor={`delete-template-${selectedTemplate.template_id}`}>
                        Type the exact template name to confirm
                      </label>
                      <input
                        id={`delete-template-${selectedTemplate.template_id}`}
                        name="confirmName"
                        placeholder={selectedTemplate.name}
                        autoComplete="off"
                        required
                      />
                    </div>
                    <div>
                      <button
                        className="button button-danger"
                        type="submit"
                        disabled={selectedTemplate.assigned_roles.length > 0}
                      >
                        Delete template
                      </button>
                    </div>
                    {selectedTemplate.assigned_roles.length ? (
                      <p className="muted small-text">Unassign this template from every role first.</p>
                    ) : null}
                  </form>
                </details>
              </div>
            </section>
          ) : null}
        </section>
      ) : null}

      {view === "assignments" ? (
        <section className="stack">
          <div className="purchase-section-heading">
            <div>
              <p className="eyebrow">Role assignments</p>
              <h2>Assign templates to roles</h2>
              <p className="muted">
                Each role can have one purchase-control template. Applying immediately updates eligible users.
              </p>
            </div>
          </div>

          <form className="card purchase-filter-card" method="get">
            <input type="hidden" name="view" value="assignments" />
            <div className="field">
              <label htmlFor="roleSearch">Find a role</label>
              <input
                id="roleSearch"
                name="roleSearch"
                defaultValue={roleSearch}
                placeholder="Role or template name"
              />
            </div>
            <button className="button button-secondary" type="submit">Search</button>
          </form>

          {visibleRoles.length ? (
            <div className="card purchase-list-card table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>Users</th>
                    <th>Current template</th>
                    <th>Rules</th>
                    <th aria-label="Action" />
                  </tr>
                </thead>
                <tbody>
                  {visibleRoles.map((role) => {
                    const assignment = assignedTemplateByRole.get(role.role_id) ?? null;
                    const selected = selectedRole?.role_id === role.role_id;
                    return (
                      <tr key={role.role_id} className={selected ? "purchase-active-row" : undefined}>
                        <td>
                          <div className="purchase-role-cell">
                            <strong>{role.name}</strong>
                            <small>Role #{role.role_id}{role.manageable ? "" : " · protected"}</small>
                          </div>
                        </td>
                        <td>{role.user_count}</td>
                        <td>
                          {assignment ? (
                            <div className="purchase-status-badges">
                              <span className="badge badge-ok">Assigned</span>
                              <span>{assignment.name}</span>
                            </div>
                          ) : (
                            <span className="badge badge-neutral">No template</span>
                          )}
                        </td>
                        <td>{assignment?.rules.length ?? "—"}</td>
                        <td>
                          <Link
                            className="purchase-open-link"
                            href={purchaseControlsHref(companyId, {
                              view: "assignments",
                              roleId: role.role_id,
                              roleSearch,
                            })}
                          >
                            {selected ? "Open" : "Change"}
                            <ChevronRightIcon />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="purchase-empty-state">
              <strong>{management.roles.length ? "No roles match this search" : "No company roles"}</strong>
              <span className="muted small-text">
                {management.roles.length
                  ? "Try another role or template name."
                  : "Create a company role before assigning purchase controls."}
              </span>
            </div>
          )}

          {selectedRole ? (
            <section className="card purchase-assignment-workspace">
              <div className="purchase-assignment-heading">
                <div>
                  <p className="eyebrow">Selected role</p>
                  <h2>{selectedRole.name}</h2>
                  <p className="muted">
                    {selectedRole.user_count} user{selectedRole.user_count === 1 ? "" : "s"}
                    {selectedRoleTemplate ? ` · ${selectedRoleTemplate.name}` : " · no template assigned"}
                  </p>
                </div>
                <Link
                  className="button button-secondary"
                  href={purchaseControlsHref(companyId, { view: "assignments", roleSearch })}
                >
                  Close
                </Link>
              </div>

              <div className="purchase-assignment-content">
                <form className="purchase-assignment-form" action={assignPurchaseControlTemplateAction}>
                  <input type="hidden" name="companyId" value={companyId} />
                  <input type="hidden" name="roleId" value={selectedRole.role_id} />
                  <div className="field">
                    <label htmlFor={`assignment-template-${selectedRole.role_id}`}>Purchase-control template</label>
                    <select
                      id={`assignment-template-${selectedRole.role_id}`}
                      name="templateId"
                      defaultValue={selectedRoleTemplate?.template_id ?? ""}
                    >
                      <option value="">No template (unassign)</option>
                      {controls.templates.map((template) => (
                        <option value={template.template_id} key={template.template_id}>
                          {template.name} · {template.rules.length} rule{template.rules.length === 1 ? "" : "s"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="purchase-operation-card">
                    <strong>Apply behaviour</strong>
                    <label className="purchase-check-field">
                      <input type="checkbox" name="applyToUsers" />
                      <span>
                        <strong>Apply immediately to eligible users</strong>
                        <span className="muted small-text">
                          Overwrite their current purchase-control allowances after saving this role assignment.
                        </span>
                      </span>
                    </label>
                  </div>
                  <div className="purchase-assignment-actions">
                    <button className="button" type="submit">Save role assignment</button>
                  </div>
                </form>
              </div>
            </section>
          ) : null}
        </section>
      ) : null}

      {view === "allowances" ? (
        <section className="stack">
          <div className="purchase-section-heading">
            <div>
              <p className="eyebrow">Current state</p>
              <h2>Applied allowances</h2>
              <p className="muted">
                These are the user-level limits actually applied from purchase-control templates.
              </p>
            </div>
          </div>

          <form className="card purchase-filter-card" method="get">
            <input type="hidden" name="view" value="allowances" />
            <div className="field">
              <label htmlFor="appliedSearch">Find an allowance</label>
              <input
                id="appliedSearch"
                name="appliedSearch"
                defaultValue={appliedSearch}
                placeholder="Customer email or SKU"
              />
            </div>
            <button className="button button-secondary" type="submit">Search</button>
          </form>

          <p className="purchase-table-count">
            Showing {applied.items.length} of {applied.total_count} allowance{applied.total_count === 1 ? "" : "s"}.
          </p>

          {applied.items.length ? (
            <div className="card purchase-list-card table-wrap purchase-allowance-table">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Product</th>
                    <th>Limit</th>
                    <th>Used</th>
                    <th>Remaining</th>
                    <th>Window</th>
                  </tr>
                </thead>
                <tbody>
                  {applied.items.map((item) => {
                    const remainingLevel = item.remaining_quantity <= 0
                      ? "none"
                      : item.remaining_quantity <= 1
                        ? "low"
                        : "ok";
                    return (
                      <tr key={item.applied_id}>
                        <td>{item.email}</td>
                        <td>
                          <strong>{item.product_name}</strong><br />
                          <code>{item.sku}</code>
                        </td>
                        <td>{item.quantity_limit}</td>
                        <td>{item.purchases_so_far}</td>
                        <td>
                          <span className="purchase-allowance-remaining" data-level={remainingLevel}>
                            {item.remaining_quantity}
                          </span>
                        </td>
                        <td>
                          {item.duration_days} days<br />
                          <span className="muted small-text">from {item.start_date}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="purchase-empty-state">
              <strong>No applied allowances found</strong>
              <span className="muted small-text">
                Try another search or apply an assigned template to eligible users.
              </span>
            </div>
          )}

          {applied.total_count > applied.items.length ? (
            <p className="purchase-pagination-note">This workspace currently displays the first 50 matching rows.</p>
          ) : null}
        </section>
      ) : null}

      {view === "history" ? (
        <section className="stack">
          <div className="purchase-section-heading">
            <div>
              <p className="eyebrow">Consumption log</p>
              <h2>Purchase history</h2>
              <p className="muted">
                Review purchases that consumed an applied allowance.
              </p>
            </div>
          </div>

          <form className="card purchase-filter-card" method="get">
            <input type="hidden" name="view" value="history" />
            <div className="field">
              <label htmlFor="historySearch">Find a purchase</label>
              <input
                id="historySearch"
                name="historySearch"
                defaultValue={historySearch}
                placeholder="Customer email, SKU or order number"
              />
            </div>
            <button className="button button-secondary" type="submit">Search</button>
          </form>

          <p className="purchase-table-count">
            Showing {history.items.length} of {history.total_count} history row{history.total_count === 1 ? "" : "s"}.
          </p>

          {history.items.length ? (
            <div className="card purchase-list-card table-wrap purchase-history-table">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Product</th>
                    <th>Order</th>
                    <th>Quantity</th>
                    <th>Ordered</th>
                  </tr>
                </thead>
                <tbody>
                  {history.items.map((item) => (
                    <tr key={item.log_id}>
                      <td>{item.email}</td>
                      <td>
                        <strong>{item.product_name}</strong><br />
                        <code>{item.sku}</code>
                      </td>
                      <td><span className="purchase-history-order">{item.order_number}</span></td>
                      <td>{item.purchased_quantity}</td>
                      <td>{formatDateTime(item.ordered_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="purchase-empty-state">
              <strong>No purchase-control history found</strong>
              <span className="muted small-text">Try another search or wait for an allowance-controlled purchase.</span>
            </div>
          )}

          {history.total_count > history.items.length ? (
            <p className="purchase-pagination-note">This workspace currently displays the first 50 matching rows.</p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
