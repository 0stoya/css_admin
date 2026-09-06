import Link from "next/link";
import { PurchaseRuleEditor } from "@/components/purchase-rule-editor";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import { getCompanyPortalAdministration, getCompanyPortalContext } from "@/lib/graphql/company-portal";
import {
  getCompanyPortalAppliedPurchaseControls,
  getCompanyPortalPurchaseControlHistory,
  getCompanyPortalPurchaseControls,
} from "@/lib/graphql/company-portal-purchase-controls";
import {
  applyPortalPurchaseControlTemplateAction,
  assignPortalPurchaseControlTemplateAction,
  deletePortalPurchaseControlTemplateAction,
  resetPortalPurchaseControlCountersAction,
  savePortalPurchaseControlTemplateAction,
} from "./actions";

export default async function CompanyPortalPurchaseControlsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string; appliedSearch?: string; historySearch?: string }>;
}) {
  const query = await searchParams;
  let administration;
  try {
    administration = await getCompanyPortalAdministration();
  } catch (error) {
    return <section className="card stack"><div><p className="eyebrow">Company portal</p><h1>Purchase controls unavailable</h1></div><div className="error">{graphQLErrorMessage(error)}</div></section>;
  }

  if (!administration.can_view_purchase_controls) {
    return (
      <section className="card stack">
        <div><p className="eyebrow">Restricted</p><h1>Purchase controls</h1></div>
        <p className="muted">Fluid has not authorized purchase-control visibility for your role in the selected company.</p>
        <Link className="back-link" href="/portal">← Company overview</Link>
      </section>
    );
  }

  const appliedSearch = query.appliedSearch?.trim() ?? "";
  const historySearch = query.historySearch?.trim() ?? "";
  let companyName = `Company ${administration.company_id}`;
  let controls;
  let applied;
  let history;
  try {
    const [context, controlsResult, appliedResult, historyResult] = await Promise.all([
      getCompanyPortalContext(),
      getCompanyPortalPurchaseControls(),
      getCompanyPortalAppliedPurchaseControls(1, 50, appliedSearch),
      getCompanyPortalPurchaseControlHistory(1, 50, historySearch),
    ]);
    controls = controlsResult;
    applied = appliedResult;
    history = historyResult;
    const selectedCompany = context.companies.find((company) => company.selected);
    if (selectedCompany?.name) companyName = selectedCompany.name;
  } catch (error) {
    return <section className="card stack"><div><p className="eyebrow">Backend request failed</p><h1>Purchase controls unavailable</h1></div><div className="error">{graphQLErrorMessage(error)}</div></section>;
  }

  const canManage = administration.can_manage_purchase_controls;
  const assignedTemplateByRole = new Map<number, { template_id: number; name: string }>();
  controls.templates.forEach((template) => {
    template.assigned_roles.forEach((role) => assignedTemplateByRole.set(role.role_id, { template_id: template.template_id, name: template.name }));
  });
  const assignedRoleCount = assignedTemplateByRole.size;

  return (
    <div className="stack control-page">
      <div className="breadcrumbs"><Link href="/portal">Company</Link><span>/</span><span>Purchase controls</span></div>
      <header className="page-header">
        <div><p className="eyebrow">{companyName}</p><h1>Purchase controls</h1><p className="muted">Review templates, role assignments, user allowances and purchase-control consumption.</p></div>
        <span className={`badge ${canManage ? "badge-ok" : "badge-neutral"}`}>{canManage ? "Manage access" : "View access"}</span>
      </header>
      {query.notice ? <div className="notice">{query.notice}</div> : null}
      {query.error ? <div className="error">{query.error}</div> : null}

      <section className="stat-grid control-summary-grid">
        <article className="stat-card"><span className="stat-value">{controls.templates.length}</span><span className="stat-label">Templates</span></article>
        <article className="stat-card"><span className="stat-value">{assignedRoleCount}/{administration.control_roles.length}</span><span className="stat-label">Roles assigned</span></article>
        <article className="stat-card"><span className="stat-value">{applied.total_count}</span><span className="stat-label">Applied allowances</span></article>
      </section>

      <nav className="control-jump-nav" aria-label="Purchase control sections">
        <a href="#templates">Templates <span className="jump-count">{controls.templates.length}</span></a>
        {canManage ? <a href="#assignments">Assignments <span className="jump-count">{assignedRoleCount}</span></a> : null}
        <a href="#allowances">Allowances <span className="jump-count">{applied.total_count}</span></a>
        <a href="#history">History <span className="jump-count">{history.total_count}</span></a>
      </nav>

      <section className="stack control-section" id="templates">
        <div className="section-heading"><div><p className="eyebrow">Templates</p><h2>Purchase-control templates</h2><p className="muted">Templates stay compact until opened. Rule and assignment state comes directly from Fluid.</p></div></div>

        {canManage ? (
          <details className="card purchase-template-create">
            <summary><span><strong>Create template</strong><span className="muted small-text">Add a reusable set of product quantity and time-window rules.</span></span></summary>
            <form className="purchase-template-create-body" action={savePortalPurchaseControlTemplateAction}>
              <div className="field"><label htmlFor="newTemplateName">Template name</label><input id="newTemplateName" name="name" required placeholder="e.g. Monthly PPE allowance" /></div>
              <PurchaseRuleEditor label="Template rules" />
              <div><button className="button" type="submit">Create template</button></div>
            </form>
          </details>
        ) : null}

        {!controls.templates.length ? (
          <div className="empty-state"><strong>No templates configured</strong><span className="muted small-text">No purchase-control templates were returned for this company.</span></div>
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
                  <div className="card-heading-row"><div><h3>{template.name}</h3><p className="muted">{template.assigned_roles.length ? `Assigned to ${template.assigned_roles.map((role) => role.role_name).join(", ")}.` : "This template is not assigned to a role."}</p></div><span className={`badge ${template.assigned_roles.length ? "badge-ok" : "badge-neutral"}`}>{template.assigned_roles.length ? "Assigned" : "Unassigned"}</span></div>

                  <div className="table-wrap"><table><thead><tr><th>Product</th><th>SKU</th><th>Limit</th><th>Window</th><th>Starts</th></tr></thead><tbody>{template.rules.map((rule) => <tr key={rule.rule_id}><td>{rule.product_name}</td><td><code>{rule.sku}</code></td><td>{rule.quantity_limit}</td><td>{rule.duration_days} days</td><td>{rule.start_date}</td></tr>)}{!template.rules.length ? <tr><td colSpan={5}>No rules in this template.</td></tr> : null}</tbody></table></div>

                  {canManage ? (
                    <>
                      <details className="policy-editor">
                        <summary className="policy-editor-summary"><span><strong>Edit template</strong><small className="muted">Change the template name or structured rule rows.</small></span></summary>
                        <form className="policy-editor-body" action={savePortalPurchaseControlTemplateAction}>
                          <input type="hidden" name="templateId" value={template.template_id} />
                          <div className="field"><label htmlFor={`template-name-${template.template_id}`}>Template name</label><input id={`template-name-${template.template_id}`} name="name" required defaultValue={template.name} /></div>
                          <PurchaseRuleEditor initialRules={template.rules} label="Template rules" />
                          <div><button className="button" type="submit">Save template</button></div>
                        </form>
                      </details>

                      <div className="purchase-template-actions">
                        <form className="purchase-action-card" action={applyPortalPurchaseControlTemplateAction}>
                          <input type="hidden" name="templateId" value={template.template_id} />
                          <div><strong>Apply to assigned users</strong><p className="muted small-text">Overwrite eligible users in currently assigned roles with this template.</p></div>
                          <label className="check-field"><input type="checkbox" name="confirmApply" value="yes" required /><span><strong>Confirm overwrite</strong><span className="muted small-text">Required before applying this template.</span></span></label>
                          <div><button className="button" type="submit" disabled={!template.assigned_roles.length}>Apply to users</button></div>
                        </form>
                        <form className="purchase-action-card" action={resetPortalPurchaseControlCountersAction}>
                          <input type="hidden" name="templateId" value={template.template_id} />
                          <div><strong>Reset consumed counters</strong><p className="muted small-text">Clear consumption counters for users currently governed by this template.</p></div>
                          <label className="check-field"><input type="checkbox" name="confirmReset" value="yes" required /><span><strong>Confirm reset</strong><span className="muted small-text">Required before clearing consumed counters.</span></span></label>
                          <div><button className="button button-secondary" type="submit" disabled={!template.assigned_roles.length}>Reset counters</button></div>
                        </form>
                      </div>

                      <details className="danger-zone">
                        <summary>Delete template</summary>
                        <form className="compact-form" action={deletePortalPurchaseControlTemplateAction}>
                          <input type="hidden" name="templateId" value={template.template_id} />
                          <div className="field"><label htmlFor={`delete-template-${template.template_id}`}>Type {template.name} to delete</label><input id={`delete-template-${template.template_id}`} name="confirmName" autoComplete="off" required /></div>
                          <button className="button button-danger" type="submit" disabled={template.assigned_roles.length > 0}>Delete template</button>
                          {template.assigned_roles.length ? <p className="muted small-text">Unassign this template from every role before deleting it.</p> : null}
                        </form>
                      </details>
                    </>
                  ) : null}
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      {canManage ? (
        <section className="stack control-section" id="assignments">
          <div className="section-heading"><div><p className="eyebrow">Assignments</p><h2>Role assignments</h2><p className="muted">See every Fluid control role and update its purchase-control template in place.</p></div></div>
          {!administration.control_roles.length ? <div className="empty-state"><strong>No control roles</strong><span className="muted small-text">No roles are available for purchase-control assignment.</span></div> : (
            <div className="table-wrap assignment-table"><table><thead><tr><th>Role</th><th>Current template</th><th>Rules</th><th>Change</th></tr></thead><tbody>{administration.control_roles.map((role) => {
              const current = assignedTemplateByRole.get(role.role_id);
              const currentTemplate = current ? controls.templates.find((template) => template.template_id === current.template_id) : undefined;
              return <tr key={role.role_id}><td><div className="assignment-role"><strong>{role.name}</strong><span className="muted small-text">Role #{role.role_id}</span></div></td><td><div className="assignment-current">{current ? <><span className="badge badge-ok">Assigned</span><span>{current.name}</span></> : <span className="badge badge-neutral">No template</span>}</div></td><td>{currentTemplate?.rules.length ?? "—"}</td><td><details className="mutation-panel"><summary>Change</summary><form className="compact-form assignment-edit" action={assignPortalPurchaseControlTemplateAction}><input type="hidden" name="roleId" value={role.role_id} /><div className="field"><label htmlFor={`role-template-${role.role_id}`}>Template</label><select id={`role-template-${role.role_id}`} name="templateId" defaultValue={current?.template_id ?? ""}><option value="">No template (unassign)</option>{controls.templates.map((template) => <option value={template.template_id} key={template.template_id}>{template.name} · {template.rules.length} rules</option>)}</select></div><label className="check-field"><input type="checkbox" name="applyToUsers" /><span><strong>Apply immediately</strong><span className="muted small-text">Overwrite eligible users after saving this assignment.</span></span></label><button className="button" type="submit">Save assignment</button></form></details></td></tr>;
            })}</tbody></table></div>
          )}
        </section>
      ) : null}

      <section className="stack control-section" id="allowances">
        <div className="section-heading"><div><p className="eyebrow">Current state</p><h2>Applied allowances</h2><p className="muted">Search user-level purchase-control limits. Showing up to 50 rows.</p></div></div>
        <form className="card inline-form" method="get"><div className="field grow"><label htmlFor="appliedSearch">Find allowance</label><input id="appliedSearch" name="appliedSearch" defaultValue={appliedSearch} placeholder="Customer email or SKU" /></div>{historySearch ? <input type="hidden" name="historySearch" value={historySearch} /> : null}<button className="button button-secondary" type="submit">Search</button></form>
        {!applied.items.length ? <div className="empty-state"><strong>No applied allowances found</strong><span className="muted small-text">No matching user-level purchase controls were returned.</span></div> : <div className="table-wrap"><table><thead><tr><th>User</th><th>Product</th><th>Limit</th><th>Used</th><th>Remaining</th><th>Window</th></tr></thead><tbody>{applied.items.map((item) => <tr key={item.applied_id}><td>{item.email}</td><td><strong>{item.product_name}</strong><br /><code>{item.sku}</code></td><td>{item.quantity_limit}</td><td>{item.purchases_so_far}</td><td><span className={`allowance-remaining ${item.remaining_quantity <= 1 ? "allowance-low" : ""}`}>{item.remaining_quantity}</span></td><td>{item.duration_days} days<br /><span className="muted small-text">from {item.start_date}</span></td></tr>)}</tbody></table></div>}
      </section>

      <section className="stack control-section" id="history">
        <div className="section-heading"><div><p className="eyebrow">Consumption log</p><h2>Purchase history</h2><p className="muted">Search purchase-control consumption by customer, product or order. Showing up to 50 rows.</p></div></div>
        <form className="card inline-form" method="get"><div className="field grow"><label htmlFor="historySearch">Find history</label><input id="historySearch" name="historySearch" defaultValue={historySearch} placeholder="Customer email, SKU or order number" /></div>{appliedSearch ? <input type="hidden" name="appliedSearch" value={appliedSearch} /> : null}<button className="button button-secondary" type="submit">Search</button></form>
        {!history.items.length ? <div className="empty-state"><strong>No purchase history found</strong><span className="muted small-text">No matching purchase-control consumption records were returned.</span></div> : <div className="table-wrap"><table><thead><tr><th>User</th><th>Product</th><th>Order</th><th>Quantity</th><th>Ordered</th></tr></thead><tbody>{history.items.map((item) => <tr key={item.log_id}><td>{item.email}</td><td><strong>{item.product_name}</strong><br /><code>{item.sku}</code></td><td className="history-order">{item.order_number}</td><td>{item.purchased_quantity}</td><td>{item.ordered_at}</td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );
}
