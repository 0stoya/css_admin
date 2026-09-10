import Link from "next/link";
import { PortalModal } from "@/components/portal/portal-modal";
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
import styles from "@/components/portal/portal-purchase-controls.module.css";

type SearchParams = Record<string, string | string[] | undefined>;
type Workspace = "templates" | "assignments" | "allowances" | "history";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function workspaceValue(value: string | undefined, canManage: boolean): Workspace {
  if (value === "allowances" || value === "history") return value;
  if (value === "assignments" && canManage) return value;
  return "templates";
}

function workspaceHref(workspace: Workspace) {
  return `/portal/purchase-controls?section=${workspace}`;
}

export default async function CompanyPortalPurchaseControlsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
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
      <section className={`card stack ${styles.restrictedCard}`}>
        <div><p className="eyebrow">Restricted</p><h1>Purchase controls</h1></div>
        <p className="muted">Your company role does not allow purchase-control viewing for the selected company.</p>
        <Link className="back-link" href="/portal">← Company overview</Link>
      </section>
    );
  }

  const appliedSearch = firstParam(query.appliedSearch)?.trim() ?? "";
  const historySearch = firstParam(query.historySearch)?.trim() ?? "";
  let companyName = `Company ${administration.company_id}`;
  let companyReference = "Selected company";
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
    if (selectedCompany?.reference) companyReference = selectedCompany.reference;
  } catch (error) {
    return <section className="card stack"><div><p className="eyebrow">Backend request failed</p><h1>Purchase controls unavailable</h1></div><div className="error">{graphQLErrorMessage(error)}</div></section>;
  }

  const canManage = administration.can_manage_purchase_controls;
  const workspace = workspaceValue(firstParam(query.section), canManage);
  const assignedTemplateByRole = new Map<number, { template_id: number; name: string }>();
  controls.templates.forEach((template) => {
    template.assigned_roles.forEach((role) => assignedTemplateByRole.set(role.role_id, { template_id: template.template_id, name: template.name }));
  });
  const assignedRoleCount = assignedTemplateByRole.size;

  return (
    <div className={styles.workspace}>
      <header className={styles.pageHeader}>
        <div>
          <p className="eyebrow">{companyReference}</p>
          <h1>Purchase controls</h1>
          <p>Set reusable product limits for company roles, then review the allowances and usage they create.</p>
        </div>
        <div className={styles.headerBadge}>
          <span>Purchase-control access</span>
          <strong>{canManage ? "Manage controls" : "View controls"}</strong>
        </div>
      </header>

      {firstParam(query.notice) ? <div className="notice">{firstParam(query.notice)}</div> : null}
      {firstParam(query.error) ? <div className="error">{firstParam(query.error)}</div> : null}

      <section className={styles.summaryGrid} aria-label="Purchase control summary">
        <article className={styles.metricCard}><span>Templates</span><strong>{controls.templates.length}</strong><small>Reusable rule sets</small></article>
        <article className={styles.metricCard}><span>Roles assigned</span><strong>{assignedRoleCount}<em> / {administration.control_roles.length}</em></strong><small>Company roles with a template</small></article>
        <article className={`${styles.metricCard} ${styles.metricPrimary}`}><span>Current allowances</span><strong>{applied.total_count}</strong><small>User-product limits currently returned</small></article>
      </section>

      <nav className={styles.workspaceTabs} aria-label="Purchase control workspace">
        <Link className={workspace === "templates" ? styles.activeTab : ""} href={workspaceHref("templates")}>
          <span>Templates</span><small>{controls.templates.length}</small>
        </Link>
        {canManage ? (
          <Link className={workspace === "assignments" ? styles.activeTab : ""} href={workspaceHref("assignments")}>
            <span>Assignments</span><small>{assignedRoleCount}</small>
          </Link>
        ) : null}
        <Link className={workspace === "allowances" ? styles.activeTab : ""} href={workspaceHref("allowances")}>
          <span>Allowances</span><small>{applied.total_count}</small>
        </Link>
        <Link className={workspace === "history" ? styles.activeTab : ""} href={workspaceHref("history")}>
          <span>History</span><small>{history.total_count}</small>
        </Link>
      </nav>

      {workspace === "templates" ? (
        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <div>
              <p className="eyebrow">Templates</p>
              <h2>Reusable purchase rules</h2>
              <p className="muted">A template groups product quantity limits and time windows so the same rules can be assigned to one or more company roles.</p>
            </div>
            {canManage ? (
              <PortalModal
                title="Create purchase-control template"
                description="Create a reusable set of product quantity and time-window rules."
                triggerLabel="Create template"
                triggerHint="Add a reusable rule set"
              >
                <form className={styles.modalStack} action={savePortalPurchaseControlTemplateAction}>
                  <div className="field"><label htmlFor="newTemplateName">Template name</label><input id="newTemplateName" name="name" required placeholder="e.g. Monthly PPE allowance" /></div>
                  <PurchaseRuleEditor label="Template rules" />
                  <div><button className="button" type="submit">Create template</button></div>
                </form>
              </PortalModal>
            ) : null}
          </div>

          {!controls.templates.length ? (
            <div className={styles.emptyState}><strong>No templates configured</strong><span>{canManage ? "Create a template to start defining product limits for company roles." : "No purchase-control templates are currently configured for this company."}</span></div>
          ) : (
            <div className={styles.templateList}>
              {controls.templates.map((template) => (
                <article className={styles.templateCard} key={template.template_id}>
                  <div className={styles.templateHeader}>
                    <div>
                      <p className="eyebrow">Template</p>
                      <h3>{template.name}</h3>
                      <span className={styles.templateId}>#{template.template_id}</span>
                    </div>
                    <span className={`badge ${template.assigned_roles.length ? "badge-ok" : "badge-neutral"}`}>{template.assigned_roles.length ? "Assigned" : "Unassigned"}</span>
                  </div>

                  <div className={styles.templateStats}>
                    <div><strong>{template.rules.length}</strong><span>Product rule{template.rules.length === 1 ? "" : "s"}</span></div>
                    <div><strong>{template.assigned_roles.length}</strong><span>Assigned role{template.assigned_roles.length === 1 ? "" : "s"}</span></div>
                  </div>

                  <div className={styles.templateRoles}>
                    {template.assigned_roles.length ? template.assigned_roles.map((role) => <span key={role.role_id}>{role.role_name}</span>) : <span className={styles.unassignedCopy}>Not currently assigned to a company role.</span>}
                  </div>

                  <div className={styles.templateFooter}>
                    <span>{template.rules.length ? `${template.rules.slice(0, 2).map((rule) => rule.product_name || rule.sku).join(", ")}${template.rules.length > 2 ? ` +${template.rules.length - 2} more` : ""}` : "No product rules yet"}</span>
                    <PortalModal
                      variant="row"
                      title={template.name}
                      description={canManage ? "Review and manage this purchase-control template." : "Review this purchase-control template."}
                      triggerLabel={canManage ? "Manage" : "View"}
                      triggerIcon={canManage ? "edit" : "arrow"}
                    >
                      <div className={styles.templateModal}>
                        <section className={styles.modalSummary}>
                          <div><span>Rules</span><strong>{template.rules.length}</strong></div>
                          <div><span>Assigned roles</span><strong>{template.assigned_roles.length}</strong></div>
                          <div><span>Status</span><strong>{template.assigned_roles.length ? "In use" : "Unassigned"}</strong></div>
                        </section>

                        <section className={styles.modalSection}>
                          <div className={styles.modalSectionHeading}><div><p className="eyebrow">Products</p><h3>Template rules</h3></div></div>
                          <div className={styles.ruleTable}>
                            <div className={`${styles.ruleRow} ${styles.tableHeader}`} aria-hidden="true"><span>Product</span><span>Limit</span><span>Window</span><span>Starts</span></div>
                            {template.rules.map((rule) => (
                              <div className={styles.ruleRow} key={rule.rule_id}>
                                <span><strong>{rule.product_name}</strong><small>{rule.sku}</small></span>
                                <span>{rule.quantity_limit}</span>
                                <span>{rule.duration_days} days</span>
                                <span>{rule.start_date}</span>
                              </div>
                            ))}
                            {!template.rules.length ? <div className={styles.emptyRow}>No product rules in this template.</div> : null}
                          </div>
                        </section>

                        {canManage ? (
                          <>
                            <section className={styles.modalSection}>
                              <div className={styles.modalSectionHeading}><div><p className="eyebrow">Edit</p><h3>Template settings</h3></div></div>
                              <form className={styles.modalStack} action={savePortalPurchaseControlTemplateAction}>
                                <input type="hidden" name="templateId" value={template.template_id} />
                                <div className="field"><label htmlFor={`template-name-${template.template_id}`}>Template name</label><input id={`template-name-${template.template_id}`} name="name" required defaultValue={template.name} /></div>
                                <PurchaseRuleEditor initialRules={template.rules} label="Template rules" />
                                <div><button className="button" type="submit">Save template</button></div>
                              </form>
                            </section>

                            <section className={styles.modalSection}>
                              <div className={styles.modalSectionHeading}><div><p className="eyebrow">Apply</p><h3>Update assigned users</h3><p>These actions affect users currently governed by this template.</p></div></div>
                              <div className={styles.actionGrid}>
                                <form className={styles.actionCard} action={applyPortalPurchaseControlTemplateAction}>
                                  <input type="hidden" name="templateId" value={template.template_id} />
                                  <div><strong>Apply latest template</strong><p>Overwrite eligible users in currently assigned roles with this template.</p></div>
                                  <label className={styles.confirmRow}><input type="checkbox" name="confirmApply" value="yes" required /><span><strong>Confirm overwrite</strong><small>Required before applying.</small></span></label>
                                  <button className="button" type="submit" disabled={!template.assigned_roles.length}>Apply to users</button>
                                </form>
                                <form className={styles.actionCard} action={resetPortalPurchaseControlCountersAction}>
                                  <input type="hidden" name="templateId" value={template.template_id} />
                                  <div><strong>Reset usage counters</strong><p>Clear consumed quantities for users currently governed by this template.</p></div>
                                  <label className={styles.confirmRow}><input type="checkbox" name="confirmReset" value="yes" required /><span><strong>Confirm reset</strong><small>Required before clearing counters.</small></span></label>
                                  <button className="button button-secondary" type="submit" disabled={!template.assigned_roles.length}>Reset counters</button>
                                </form>
                              </div>
                            </section>

                            <details className={styles.dangerZone}>
                              <summary>Delete template</summary>
                              <form className={styles.deleteForm} action={deletePortalPurchaseControlTemplateAction}>
                                <input type="hidden" name="templateId" value={template.template_id} />
                                <div>
                                  <strong>Delete {template.name}</strong>
                                  <p>{template.assigned_roles.length ? "Unassign this template from every role before deleting it." : "This permanently removes the template."}</p>
                                </div>
                                <div className="field"><label htmlFor={`delete-template-${template.template_id}`}>Type {template.name} to confirm</label><input id={`delete-template-${template.template_id}`} name="confirmName" autoComplete="off" required /></div>
                                <button className="button button-danger" type="submit" disabled={template.assigned_roles.length > 0}>Delete template</button>
                              </form>
                            </details>
                          </>
                        ) : null}
                      </div>
                    </PortalModal>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {workspace === "assignments" && canManage ? (
        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <div>
              <p className="eyebrow">Assignments</p>
              <h2>Which roles use which template?</h2>
              <p className="muted">Each company role can have one purchase-control template. Changing an assignment does not have to overwrite current user allowances unless you choose Apply immediately.</p>
            </div>
          </div>

          {!administration.control_roles.length ? (
            <div className={styles.emptyState}><strong>No company roles available</strong><span>No roles are currently available for purchase-control assignment.</span></div>
          ) : (
            <div className={styles.assignmentGrid}>
              {administration.control_roles.map((role) => {
                const current = assignedTemplateByRole.get(role.role_id);
                const currentTemplate = current ? controls.templates.find((template) => template.template_id === current.template_id) : undefined;
                return (
                  <article className={styles.assignmentCard} key={role.role_id}>
                    <div className={styles.assignmentHeader}>
                      <div><p className="eyebrow">Company role</p><h3>{role.name}</h3></div>
                      <span className={`badge ${current ? "badge-ok" : "badge-neutral"}`}>{current ? "Assigned" : "No template"}</span>
                    </div>
                    <div className={styles.assignmentBody}>
                      <span>Current template</span>
                      <strong>{current?.name ?? "No purchase-control template"}</strong>
                      <small>{currentTemplate ? `${currentTemplate.rules.length} product rule${currentTemplate.rules.length === 1 ? "" : "s"}` : "This role currently has no template assignment."}</small>
                    </div>
                    <div className={styles.assignmentFooter}>
                      <span>Role #{role.role_id}</span>
                      <PortalModal
                        variant="row"
                        title={`${role.name} purchase controls`}
                        description="Choose the template assigned to this company role."
                        triggerLabel="Change"
                        triggerIcon="edit"
                      >
                        <form className={styles.modalStack} action={assignPortalPurchaseControlTemplateAction}>
                          <input type="hidden" name="roleId" value={role.role_id} />
                          <div className={styles.currentAssignment}>
                            <span>Current assignment</span>
                            <strong>{current?.name ?? "No template"}</strong>
                          </div>
                          <div className="field">
                            <label htmlFor={`role-template-${role.role_id}`}>Template</label>
                            <select id={`role-template-${role.role_id}`} name="templateId" defaultValue={current?.template_id ?? ""}>
                              <option value="">No template (unassign)</option>
                              {controls.templates.map((template) => <option value={template.template_id} key={template.template_id}>{template.name} · {template.rules.length} rules</option>)}
                            </select>
                          </div>
                          <label className={styles.confirmRow}><input type="checkbox" name="applyToUsers" /><span><strong>Apply immediately to eligible users</strong><small>Overwrite current user allowances after saving this assignment.</small></span></label>
                          <div><button className="button" type="submit">Save assignment</button></div>
                        </form>
                      </PortalModal>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {workspace === "allowances" ? (
        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <div>
              <p className="eyebrow">Allowances</p>
              <h2>Current user limits</h2>
              <p className="muted">Review the product limits currently applied to individual users. The backend returns up to 50 matching rows.</p>
            </div>
            <span className={styles.sectionCount}>{applied.total_count}</span>
          </div>

          <form className={styles.searchBar} method="get">
            <input type="hidden" name="section" value="allowances" />
            <div className="field grow"><label htmlFor="appliedSearch">Find allowance</label><input id="appliedSearch" name="appliedSearch" defaultValue={appliedSearch} placeholder="Customer email or SKU" /></div>
            <button className="button button-secondary" type="submit">Search</button>
            {appliedSearch ? <Link className="button button-secondary button-link" href={workspaceHref("allowances")}>Clear</Link> : null}
          </form>

          {!applied.items.length ? (
            <div className={styles.emptyState}><strong>No allowances found</strong><span>{appliedSearch ? "No current allowances match this search." : "No user-level purchase-control allowances were returned for this company."}</span></div>
          ) : (
            <div className={styles.dataTable}>
              <div className={`${styles.allowanceRow} ${styles.tableHeader}`} aria-hidden="true"><span>User</span><span>Product</span><span>Used</span><span>Remaining</span><span>Window</span></div>
              {applied.items.map((item) => (
                <div className={styles.allowanceRow} key={item.applied_id}>
                  <span><strong>{item.email}</strong></span>
                  <span><strong>{item.product_name}</strong><small>{item.sku}</small></span>
                  <span>{item.purchases_so_far} / {item.quantity_limit}</span>
                  <span><strong className={item.remaining_quantity <= 1 ? styles.lowRemaining : ""}>{item.remaining_quantity}</strong></span>
                  <span><strong>{item.duration_days} days</strong><small>from {item.start_date}</small></span>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {workspace === "history" ? (
        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <div>
              <p className="eyebrow">History</p>
              <h2>Purchase-control usage</h2>
              <p className="muted">Review recorded consumption by customer, product or order. The backend returns up to 50 matching rows.</p>
            </div>
            <span className={styles.sectionCount}>{history.total_count}</span>
          </div>

          <form className={styles.searchBar} method="get">
            <input type="hidden" name="section" value="history" />
            <div className="field grow"><label htmlFor="historySearch">Find usage</label><input id="historySearch" name="historySearch" defaultValue={historySearch} placeholder="Customer email, SKU or order number" /></div>
            <button className="button button-secondary" type="submit">Search</button>
            {historySearch ? <Link className="button button-secondary button-link" href={workspaceHref("history")}>Clear</Link> : null}
          </form>

          {!history.items.length ? (
            <div className={styles.emptyState}><strong>No usage history found</strong><span>{historySearch ? "No purchase-control usage matches this search." : "No purchase-control consumption has been recorded for this company."}</span></div>
          ) : (
            <div className={styles.dataTable}>
              <div className={`${styles.historyRow} ${styles.tableHeader}`} aria-hidden="true"><span>User</span><span>Product</span><span>Order</span><span>Quantity</span><span>Ordered</span></div>
              {history.items.map((item) => (
                <div className={styles.historyRow} key={item.log_id}>
                  <span><strong>{item.email}</strong></span>
                  <span><strong>{item.product_name}</strong><small>{item.sku}</small></span>
                  <span><strong>{item.order_number}</strong></span>
                  <span>{item.purchased_quantity}</span>
                  <span>{item.ordered_at}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
