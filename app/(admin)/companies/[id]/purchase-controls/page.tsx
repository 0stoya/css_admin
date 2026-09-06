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

async function loadPurchaseControls(companyId: number, appliedSearch: string, historySearch: string) {
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
    return { company: null, management: null, controls: null, applied: null, history: null, error: graphQLErrorMessage(error) };
  }
}

export default async function PurchaseControlsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string; appliedSearch?: string; historySearch?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const companyId = Number(id);
  if (!Number.isInteger(companyId) || companyId <= 0) notFound();

  const appliedSearch = query.appliedSearch?.trim() ?? "";
  const historySearch = query.historySearch?.trim() ?? "";
  const { company, management, controls, applied, history, error } = await loadPurchaseControls(companyId, appliedSearch, historySearch);

  if (!company || !management || !controls || !applied || !history) {
    return (
      <div className="stack">
        <div><Link className="back-link" href={`/companies/${companyId}`}>← Company</Link></div>
        <section className="card stack"><div><p className="eyebrow">Backend request failed</p><h1>Purchase controls unavailable</h1></div><div className="error">{error}</div></section>
      </div>
    );
  }

  const assignedTemplateByRole = new Map<number, { template_id: number; name: string }>();
  controls.templates.forEach((template) => {
    template.assigned_roles.forEach((role) => assignedTemplateByRole.set(role.role_id, { template_id: template.template_id, name: template.name }));
  });
  const assignedRoleCount = assignedTemplateByRole.size;

  return (
    <div className="stack control-page">
      <div className="breadcrumbs">
        <Link href="/companies">Companies</Link><span aria-hidden="true">/</span>
        <Link href={`/companies/${companyId}`}>{company.name}</Link><span aria-hidden="true">/</span>
        <span>Purchase controls</span>
      </div>

      <header className="page-header">
        <div><p className="eyebrow">Purchase controls</p><h1>Purchase controls</h1><p className="muted">Build reusable product limits, assign them to roles and review the allowances applied to company users.</p></div>
      </header>

      {query.notice ? <div className="success">{query.notice}</div> : null}
      {query.error ? <div className="error">{query.error}</div> : null}

      <section className="stat-grid control-summary-grid">
        <article className="stat-card"><span className="stat-value">{controls.templates.length}</span><span className="stat-label">Templates</span></article>
        <article className="stat-card"><span className="stat-value">{assignedRoleCount}/{management.roles.length}</span><span className="stat-label">Roles assigned</span></article>
        <article className="stat-card"><span className="stat-value">{applied.total_count}</span><span className="stat-label">Applied allowances</span></article>
      </section>

      <nav className="control-jump-nav" aria-label="Purchase control sections">
        <a href="#templates">Templates <span className="jump-count">{controls.templates.length}</span></a>
        <a href="#assignments">Assignments <span className="jump-count">{assignedRoleCount}</span></a>
        <a href="#allowances">Allowances <span className="jump-count">{applied.total_count}</span></a>
        <a href="#history">History <span className="jump-count">{history.total_count}</span></a>
      </nav>

      <section className="stack control-section" id="templates">
        <div className="section-heading">
          <div><p className="eyebrow">Templates</p><h2>Purchase-control templates</h2><p className="muted">Templates stay compact until you open one. Saving a template atomically replaces its complete rule set.</p></div>
        </div>

        <details className="card purchase-template-create">
          <summary><span><strong>Create template</strong><span className="muted small-text">Add a reusable set of product quantity and time-window rules.</span></span></summary>
          <form className="purchase-template-create-body" action={savePurchaseControlTemplateAction}>
            <input type="hidden" name="companyId" value={companyId} />
            <div className="field"><label htmlFor="newTemplateName">Template name</label><input id="newTemplateName" name="name" required placeholder="e.g. Monthly PPE allowance" /></div>
            <PurchaseRuleEditor label="Template rules" />
            <div><button className="button" type="submit">Create template</button></div>
          </form>
        </details>

        {!controls.templates.length ? (
          <div className="empty-state"><strong>No templates configured</strong><span className="muted small-text">Create a template when this company needs product quantity or time-window controls.</span></div>
        ) : (
          <div className="purchase-template-list">
            {controls.templates.map((template) => (
              <details className="card purchase-template-panel" key={template.template_id}>
                <summary>
                  <span className="purchase-template-title"><strong>{template.name}</strong><small>Template #{template.template_id}</small></span>
                  <span className="purchase-template-summary-stat"><strong>{template.rules.length}</strong><span>Rules</span></span>
                  <span className="purchase-template-summary-stat"><strong>{template.assigned_roles.length}</strong><span>Roles</span></span>
                  <span className="purchase-template-expand" aria-hidden="true" />
                </summary>
                <div className="purchase-template-body">
                  <div className="card-heading-row">
                    <div><h3>{template.name}</h3><p className="muted">{template.assigned_roles.length ? `Assigned to ${template.assigned_roles.map((role) => role.role_name).join(", ")}.` : "This template is not assigned to a role."}</p></div>
                    <span className={`badge ${template.assigned_roles.length ? "badge-ok" : "badge-neutral"}`}>{template.assigned_roles.length ? "Assigned" : "Unassigned"}</span>
                  </div>

                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Product</th><th>SKU</th><th>Limit</th><th>Window</th><th>Starts</th></tr></thead>
                      <tbody>
                        {template.rules.map((rule) => <tr key={rule.rule_id}><td>{rule.product_name}</td><td><code>{rule.sku}</code></td><td>{rule.quantity_limit}</td><td>{rule.duration_days} days</td><td>{rule.start_date}</td></tr>)}
                        {!template.rules.length ? <tr><td colSpan={5}>No rules in this template.</td></tr> : null}
                      </tbody>
                    </table>
                  </div>

                  <details className="policy-editor">
                    <summary className="policy-editor-summary"><span><strong>Edit template</strong><small className="muted">Change the template name or structured rule rows.</small></span></summary>
                    <form className="policy-editor-body" action={savePurchaseControlTemplateAction}>
                      <input type="hidden" name="companyId" value={companyId} />
                      <input type="hidden" name="templateId" value={template.template_id} />
                      <div className="field"><label htmlFor={`template-name-${template.template_id}`}>Template name</label><input id={`template-name-${template.template_id}`} name="name" required defaultValue={template.name} /></div>
                      <PurchaseRuleEditor initialRules={template.rules} label="Template rules" />
                      <div><button className="button" type="submit">Save template</button></div>
                    </form>
                  </details>

                  <div className="purchase-template-actions">
                    <form className="purchase-action-card" action={applyPurchaseControlTemplateAction}>
                      <input type="hidden" name="companyId" value={companyId} />
                      <input type="hidden" name="templateId" value={template.template_id} />
                      <div><strong>Apply to assigned users</strong><p className="muted small-text">Overwrite eligible users in currently assigned roles with this template.</p></div>
                      <label className="check-field"><input type="checkbox" name="confirmApply" value="yes" required /><span><strong>Confirm overwrite</strong><span className="muted small-text">Required before applying this template.</span></span></label>
                      <div><button className="button" type="submit" disabled={!template.assigned_roles.length}>Apply to users</button></div>
                    </form>
                    <form className="purchase-action-card" action={resetPurchaseControlCountersAction}>
                      <input type="hidden" name="companyId" value={companyId} />
                      <input type="hidden" name="templateId" value={template.template_id} />
                      <div><strong>Reset consumed counters</strong><p className="muted small-text">Clear consumption counters for users currently governed by this template.</p></div>
                      <label className="check-field"><input type="checkbox" name="confirmReset" value="yes" required /><span><strong>Confirm reset</strong><span className="muted small-text">Required before clearing consumed counters.</span></span></label>
                      <div><button className="button button-secondary" type="submit" disabled={!template.assigned_roles.length}>Reset counters</button></div>
                    </form>
                  </div>

                  <details className="danger-zone">
                    <summary>Delete template</summary>
                    <form className="compact-form" action={deletePurchaseControlTemplateAction}>
                      <input type="hidden" name="companyId" value={companyId} />
                      <input type="hidden" name="templateId" value={template.template_id} />
                      <div className="field"><label htmlFor={`delete-template-${template.template_id}`}>Type {template.name} to delete</label><input id={`delete-template-${template.template_id}`} name="confirmName" placeholder={template.name} autoComplete="off" required /></div>
                      <button className="button button-danger" type="submit" disabled={template.assigned_roles.length > 0}>Delete template</button>
                      {template.assigned_roles.length ? <p className="muted small-text">Unassign this template from every role before deleting it.</p> : null}
                    </form>
                  </details>
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      <section className="stack control-section" id="assignments">
        <div className="section-heading"><div><p className="eyebrow">Assignments</p><h2>Role assignments</h2><p className="muted">See every company role and change its purchase-control template in place.</p></div></div>
        {!management.roles.length ? (
          <div className="empty-state"><strong>No company roles</strong><span className="muted small-text">Create a role before assigning a purchase-control template.</span></div>
        ) : (
          <div className="table-wrap assignment-table">
            <table>
              <thead><tr><th>Role</th><th>Current template</th><th>Rules</th><th>Change</th></tr></thead>
              <tbody>
                {management.roles.map((role) => {
                  const current = assignedTemplateByRole.get(role.role_id);
                  const currentTemplate = current ? controls.templates.find((template) => template.template_id === current.template_id) : undefined;
                  return (
                    <tr key={role.role_id}>
                      <td><div className="assignment-role"><strong>{role.name}</strong><span className="muted small-text">Role #{role.role_id}{role.manageable ? "" : " · protected"}</span></div></td>
                      <td><div className="assignment-current">{current ? <><span className="badge badge-ok">Assigned</span><span>{current.name}</span></> : <span className="badge badge-neutral">No template</span>}</div></td>
                      <td>{currentTemplate?.rules.length ?? "—"}</td>
                      <td>
                        <details className="mutation-panel"><summary>Change</summary>
                          <form className="compact-form assignment-edit" action={assignPurchaseControlTemplateAction}>
                            <input type="hidden" name="companyId" value={companyId} /><input type="hidden" name="roleId" value={role.role_id} />
                            <div className="field"><label htmlFor={`role-template-${role.role_id}`}>Template</label><select id={`role-template-${role.role_id}`} name="templateId" defaultValue={current?.template_id ?? ""}><option value="">No template (unassign)</option>{controls.templates.map((template) => <option value={template.template_id} key={template.template_id}>{template.name} · {template.rules.length} rules</option>)}</select></div>
                            <label className="check-field"><input type="checkbox" name="applyToUsers" /><span><strong>Apply immediately</strong><span className="muted small-text">Overwrite eligible users after saving this assignment.</span></span></label>
                            <button className="button" type="submit">Save assignment</button>
                          </form>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="stack control-section" id="allowances">
        <div className="section-heading"><div><p className="eyebrow">Current state</p><h2>Applied allowances</h2><p className="muted">Search the user-level limits that have actually been applied. Showing up to 50 rows.</p></div></div>
        <form className="card inline-form" method="get">
          <div className="field grow"><label htmlFor="appliedSearch">Find allowance</label><input id="appliedSearch" name="appliedSearch" defaultValue={appliedSearch} placeholder="Customer email or SKU" /></div>
          {historySearch ? <input type="hidden" name="historySearch" value={historySearch} /> : null}
          <button className="button button-secondary" type="submit">Search</button>
        </form>
        {!applied.items.length ? (
          <div className="empty-state"><strong>No applied allowances found</strong><span className="muted small-text">Try another search or apply an assigned template to eligible users.</span></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>User</th><th>Product</th><th>Limit</th><th>Used</th><th>Remaining</th><th>Window</th></tr></thead>
              <tbody>
                {applied.items.map((item) => (
                  <tr key={item.applied_id}>
                    <td>{item.email}</td>
                    <td><strong>{item.product_name}</strong><br /><code>{item.sku}</code></td>
                    <td>{item.quantity_limit}</td><td>{item.purchases_so_far}</td>
                    <td><span className={`allowance-remaining ${item.remaining_quantity <= 1 ? "allowance-low" : ""}`}>{item.remaining_quantity}</span></td>
                    <td>{item.duration_days} days<br /><span className="muted small-text">from {item.start_date}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="stack control-section" id="history">
        <div className="section-heading"><div><p className="eyebrow">Consumption log</p><h2>Purchase history</h2><p className="muted">Search purchase-control consumption by customer, product or order. Showing up to 50 rows.</p></div></div>
        <form className="card inline-form" method="get">
          <div className="field grow"><label htmlFor="historySearch">Find history</label><input id="historySearch" name="historySearch" defaultValue={historySearch} placeholder="Customer email, SKU or order number" /></div>
          {appliedSearch ? <input type="hidden" name="appliedSearch" value={appliedSearch} /> : null}
          <button className="button button-secondary" type="submit">Search</button>
        </form>
        {!history.items.length ? (
          <div className="empty-state"><strong>No purchase history found</strong><span className="muted small-text">No matching purchase-control consumption records were returned.</span></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>User</th><th>Product</th><th>Order</th><th>Quantity</th><th>Ordered</th></tr></thead>
              <tbody>
                {history.items.map((item) => <tr key={item.log_id}><td>{item.email}</td><td><strong>{item.product_name}</strong><br /><code>{item.sku}</code></td><td className="history-order">{item.order_number}</td><td>{item.purchased_quantity}</td><td>{item.ordered_at}</td></tr>)}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
