import Link from "next/link";
import { CompanyPermissionPicker } from "@/components/company-permission-picker";
import styles from "@/components/portal/portal-dashboard.module.css";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import {
  getCompanyPortalAdministration,
  getCompanyPortalContext,
  type CompanyPortalAdministration,
  type CompanyPortalContext,
  type CompanyPortalUser,
} from "@/lib/graphql/company-portal";
import { getPortalEmployeeConfiguration } from "@/lib/graphql/company-portal-employees";
import {
  deletePortalRoleAction,
  removePortalUserAction,
  savePortalRoleAction,
  selectPortalCompanyAction,
  updatePortalUserAction,
} from "./actions";

async function loadPortal() {
  let context: CompanyPortalContext | null = null;
  let administration: CompanyPortalAdministration | null = null;
  let canViewEmployees = false;
  let error: string | null = null;

  try {
    context = await getCompanyPortalContext();
  } catch (requestError) {
    return { context, administration, canViewEmployees, error: graphQLErrorMessage(requestError) };
  }

  if (context.selected_company_id !== null) {
    const [administrationResult, employeeResult] = await Promise.allSettled([
      getCompanyPortalAdministration(),
      getPortalEmployeeConfiguration(),
    ]);

    if (administrationResult.status === "fulfilled") {
      administration = administrationResult.value;
    } else {
      error = graphQLErrorMessage(administrationResult.reason);
    }

    canViewEmployees = employeeResult.status === "fulfilled";
  }

  return { context, administration, canViewEmployees, error };
}

function userName(user: Pick<CompanyPortalUser, "firstname" | "lastname">) {
  return `${user.firstname} ${user.lastname}`.trim();
}

function resourcePathMap(administration: CompanyPortalAdministration) {
  const byId = new Map(administration.resources.map((resource) => [resource.resource_id, resource]));
  const paths = new Map<string, string>();

  function pathFor(resourceId: string, visiting = new Set<string>()): string {
    const cached = paths.get(resourceId);
    if (cached) return cached;
    const resource = byId.get(resourceId);
    if (!resource) return resourceId;
    if (visiting.has(resourceId)) return resource.title;
    visiting.add(resourceId);
    const parent = resource.parent_resource_id ? byId.get(resource.parent_resource_id) : null;
    const path = parent ? `${pathFor(parent.resource_id, visiting)} > ${resource.title}` : resource.title;
    paths.set(resourceId, path);
    visiting.delete(resourceId);
    return path;
  }

  administration.resources.forEach((resource) => pathFor(resource.resource_id));
  return paths;
}

export default async function CompanyPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const { context, administration, canViewEmployees, error } = await loadPortal();
  const message = params.error || error;

  if (!context) {
    return (
      <section className={styles.emptyState}>
        <div><p className="eyebrow">Company portal</p><h2>Company account unavailable</h2></div>
        {message ? <div className="error">{message}</div> : null}
      </section>
    );
  }

  const selected = context.companies.find((company) => company.selected) ?? null;
  const usersById = new Map(administration?.users.map((user) => [user.user_id, user]) ?? []);
  const resourcePaths = administration ? resourcePathMap(administration) : new Map<string, string>();

  if (!selected) {
    return (
      <div className={styles.dashboard}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.kicker}>Company portal</span>
            <h1>Select your company</h1>
            <p className={styles.heroLead}>Choose the company account you want to manage.</p>
          </div>
          <div className={styles.heroContext}>
            {context.companies.length ? (
              <form className={styles.switcher} action={selectPortalCompanyAction}>
                <select name="companyId" aria-label="Company">
                  {context.companies.map((company) => (
                    <option key={company.company_id} value={company.company_id}>
                      {company.name || `Company ${company.company_id}`}{company.reference ? ` (${company.reference})` : ""}
                    </option>
                  ))}
                </select>
                <button type="submit">Continue</button>
              </form>
            ) : <p className="muted">This account is not assigned to a company.</p>}
          </div>
        </section>
      </div>
    );
  }

  const quickActions = [
    {
      href: "/portal/company-profile",
      eyebrow: "Account",
      title: "Company profile",
      description: "View company contact information and your Chelmsford account representative.",
    },
    ...(canViewEmployees ? [{
      href: "/portal/employees",
      eyebrow: "People",
      title: "Employees",
      description: "Maintain employee records and the company data available to your team.",
    }] : []),
    ...(administration?.can_manage_catalog_visibility ? [{
      href: "/portal/catalog",
      eyebrow: "Products",
      title: "Catalogue",
      description: "Control which products and categories are available to your company and roles.",
    }] : []),
    ...(administration?.can_view_purchase_controls ? [{
      href: "/portal/purchase-controls",
      eyebrow: "Purchasing",
      title: "Purchase controls",
      description: administration.can_manage_purchase_controls
        ? "Manage allowances, templates, assignments and purchase counters."
        : "View your company purchase controls, allowances and history.",
    }] : []),
  ];

  const accessItems = administration ? [
    ["View company users", administration.can_view_users],
    ["Manage company users", administration.can_manage_users],
    ["View roles", administration.can_view_roles],
    ["Manage roles", administration.can_manage_roles],
    ["Manage catalogue", administration.can_manage_catalog_visibility],
    ["View purchase controls", administration.can_view_purchase_controls],
    ["Manage purchase controls", administration.can_manage_purchase_controls],
  ] as const : [];

  return (
    <div className={styles.dashboard}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.kicker}>{selected.reference || "Your company"}</span>
          <h1>{selected.name || "Your company account"}</h1>
          <p className={styles.heroLead}>Your company services, people and purchasing controls in one place.</p>
        </div>

        <div className={styles.heroContext}>
          <div className={styles.contextTop}>
            <div className={styles.contextLabel}>
              <span>Current company</span>
              <strong>{selected.name || `Company ${selected.company_id}`}</strong>
            </div>
            <span className={`${styles.status}${selected.active ? "" : ` ${styles.statusInactive}`}`}>
              {selected.active ? "Active" : "Inactive"}
            </span>
          </div>

          {context.companies.length > 1 ? (
            <form className={styles.switcher} action={selectPortalCompanyAction}>
              <select name="companyId" defaultValue={context.selected_company_id ?? undefined} aria-label="Switch company">
                {context.companies.map((company) => (
                  <option key={company.company_id} value={company.company_id}>
                    {company.name || `Company ${company.company_id}`}{company.reference ? ` (${company.reference})` : ""}{!company.active ? " — inactive" : ""}
                  </option>
                ))}
              </select>
              <button type="submit">Switch</button>
            </form>
          ) : (
            <div className={styles.contextLabel}>
              <span>Account reference</span>
              <strong>{selected.reference || "—"}</strong>
            </div>
          )}
        </div>
      </section>

      {(params.success || message) ? (
        <div className={styles.alertStack}>
          {params.success ? <div className="notice" role="status">{params.success}</div> : null}
          {message ? <div className="error" role="alert">{message}</div> : null}
        </div>
      ) : null}

      <section className={styles.section} aria-labelledby="portal-services-heading">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="portal-services-heading">Your company services</h2>
            <p>Open the areas available to your account.</p>
          </div>
        </div>
        <div className={styles.actionGrid}>
          {quickActions.map((action) => (
            <Link className={styles.actionCard} href={action.href} key={action.href}>
              <span className={styles.actionEyebrow}>{action.eyebrow}</span>
              <h3>{action.title}</h3>
              <p>{action.description}</p>
              <span className={styles.actionArrow}>Open <span aria-hidden="true">→</span></span>
            </Link>
          ))}
        </div>
      </section>

      {administration ? (
        <section className={styles.section} aria-labelledby="account-summary-heading">
          <div className={styles.sectionHeading}>
            <div>
              <h2 id="account-summary-heading">At a glance</h2>
              <p>A simple view of your current company access.</p>
            </div>
          </div>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryValue}>{administration.is_company_admin ? "Administrator" : "Company role"}</span>
              <span className={styles.summaryLabel}>Your access level</span>
            </div>
            {administration.can_view_users ? (
              <div className={styles.summaryCard}>
                <span className={styles.summaryValue}>{administration.users.length}</span>
                <span className={styles.summaryLabel}>Company users</span>
              </div>
            ) : null}
            {administration.can_view_roles ? (
              <div className={styles.summaryCard}>
                <span className={styles.summaryValue}>{administration.roles.length}</span>
                <span className={styles.summaryLabel}>Company roles</span>
              </div>
            ) : null}
            <div className={styles.summaryCard}>
              <span className={styles.summaryValue}>{administration.can_manage_purchase_controls ? "Manage" : administration.can_view_purchase_controls ? "View" : "Not enabled"}</span>
              <span className={styles.summaryLabel}>Purchase controls</span>
            </div>
          </div>
        </section>
      ) : null}

      {administration && (administration.can_view_users || administration.can_view_roles) ? (
        <section className={styles.section} id="team-access" aria-labelledby="team-access-heading">
          <div className={styles.sectionHeading}>
            <div>
              <h2 id="team-access-heading">Team &amp; access</h2>
              <p>Manage company users and roles where your account permissions allow.</p>
            </div>
          </div>

          <nav className={styles.managementNav} aria-label="Team and access sections">
            {administration.can_view_users ? <a href="#portal-users">Users <span>{administration.users.length}</span></a> : null}
            {administration.can_view_roles ? <a href="#portal-roles">Roles <span>{administration.roles.length}</span></a> : null}
          </nav>

          {administration.can_view_users ? (
            <section className={`card stack management-section ${styles.managementCard}`} id="portal-users">
              <div>
                <p className="eyebrow">People</p>
                <h2>Company users</h2>
                <p className="muted">Maintain role, manager and approval settings for your company team.</p>
              </div>
              {administration.users.length ? (
                <div className="table-wrap management-table">
                  <table>
                    <thead><tr><th>User</th><th>Role</th><th>Manager</th><th>Approval</th><th>Capabilities</th><th>Manage</th></tr></thead>
                    <tbody>
                      {administration.users.map((user) => {
                        const manager = user.manager_user_id === null ? null : usersById.get(user.manager_user_id);
                        return (
                          <tr key={user.user_id}>
                            <td><div className="cell-stack"><strong>{userName(user)}</strong><span className="muted small-text">{user.email}</span>{user.is_company_admin ? <span className="badge badge-ok">Company admin</span> : null}</div></td>
                            <td>{user.roles.map((role) => role.name).join(", ") || "—"}</td>
                            <td>{manager ? userName(manager) : user.manager_user_id === null ? "—" : `User #${user.manager_user_id}`}</td>
                            <td>{user.approval_type}{user.approval_threshold !== null ? ` · ${user.approval_threshold}` : ""}</td>
                            <td><div className="capability-list"><span>{user.can_checkout ? "✓" : "—"} Checkout</span><span>{user.can_approve_credit_orders ? "✓" : "—"} Credit approval</span><span>{user.can_auto_approve_credit_order ? "✓" : "—"} Auto-approve</span></div></td>
                            <td>
                              {administration.can_manage_users && !user.is_company_admin && administration.roles.length ? (
                                <details className="mutation-panel management-edit-panel"><summary>Edit</summary><div className="management-edit-body">
                                  <form className="compact-form" action={updatePortalUserAction}>
                                    <input type="hidden" name="userId" value={user.user_id} />
                                    <div className="field"><label htmlFor={`role-${user.user_id}`}>Role</label><select id={`role-${user.user_id}`} name="roleId" defaultValue={user.roles[0]?.role_id ?? ""} required><option value="" disabled>Select a role</option>{administration.roles.map((role) => <option key={role.role_id} value={role.role_id}>{role.name}</option>)}</select></div>
                                    <div className="field"><label htmlFor={`manager-${user.user_id}`}>Manager</label><select id={`manager-${user.user_id}`} name="managerId" defaultValue={user.manager_user_id ?? ""}><option value="">No manager</option>{administration.users.filter((candidate) => candidate.user_id !== user.user_id).map((candidate) => <option key={candidate.user_id} value={candidate.user_id}>{userName(candidate)} · {candidate.email}</option>)}</select></div>
                                    <div className="field"><label htmlFor={`approval-${user.user_id}`}>Approval type</label><input id={`approval-${user.user_id}`} name="approvalType" defaultValue={user.approval_type} /></div>
                                    <div className="field"><label htmlFor={`threshold-${user.user_id}`}>Approval threshold</label><input id={`threshold-${user.user_id}`} name="approvalThreshold" type="number" step="any" defaultValue={user.approval_threshold ?? ""} /></div>
                                    <button className="button" type="submit">Save user</button>
                                  </form>
                                  <form className="danger-zone" action={removePortalUserAction}><input type="hidden" name="userId" value={user.user_id} /><div className="field"><label htmlFor={`remove-${user.user_id}`}>Type {user.email} to remove</label><input id={`remove-${user.user_id}`} name="confirmEmail" autoComplete="off" required /></div><button className="button button-danger" type="submit">Remove company user</button></form>
                                </div></details>
                              ) : user.is_company_admin ? <span className="muted small-text">Protected</span> : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : <p className="muted">No users are currently available for this company.</p>}
            </section>
          ) : null}

          {administration.can_view_roles ? (
            <section className={`card stack management-section ${styles.managementCard}`} id="portal-roles">
              <div>
                <p className="eyebrow">Permissions</p>
                <h2>Company roles</h2>
                <p className="muted">Control the permissions assigned to each company role.</p>
              </div>

              {administration.can_manage_roles ? (
                <details className="management-create-panel nested-card">
                  <summary><span><strong>Create role</strong><small>Select permissions by group.</small></span></summary>
                  <form className="management-panel-body stack" action={savePortalRoleAction}>
                    <div className="form-grid"><div className="field"><label htmlFor="newRoleName">Role name</label><input id="newRoleName" name="name" required /></div><div className="field"><label htmlFor="newRoleSort">Sort order</label><input id="newRoleSort" name="sortOrder" type="number" step="1" /></div></div>
                    <CompanyPermissionPicker resources={administration.resources} label="Role permissions" />
                    <div><button className="button" type="submit">Create role</button></div>
                  </form>
                </details>
              ) : null}

              {administration.roles.length ? (
                <div className="table-wrap management-table">
                  <table>
                    <thead><tr><th>Role</th><th>Users</th><th>Sort</th><th>Permissions</th><th>Manage</th></tr></thead>
                    <tbody>
                      {administration.roles.map((role) => (
                        <tr key={role.role_id}>
                          <td><div className="cell-stack"><strong>{role.name}</strong>{!role.manageable ? <span className="badge badge-neutral">Protected</span> : null}</div></td>
                          <td>{role.user_count}</td>
                          <td>{role.sort_order}</td>
                          <td><details className="resource-details compact-resource-summary"><summary>{role.allowed_resources.length} assigned</summary>{role.allowed_resources.length ? <ul className="compact-list">{role.allowed_resources.map((resourceId) => <li key={resourceId}>{resourcePaths.get(resourceId) ?? resourceId}</li>)}</ul> : <p className="muted small-text">No explicit permissions returned.</p>}</details></td>
                          <td>
                            {administration.can_manage_roles && role.manageable ? (
                              <details className="mutation-panel management-edit-panel"><summary>Edit</summary><div className="management-edit-body role-edit-body">
                                <form className="stack" action={savePortalRoleAction}>
                                  <input type="hidden" name="roleId" value={role.role_id} />
                                  <div className="form-grid"><div className="field"><label htmlFor={`role-name-${role.role_id}`}>Role name</label><input id={`role-name-${role.role_id}`} name="name" defaultValue={role.name} required /></div><div className="field"><label htmlFor={`role-sort-${role.role_id}`}>Sort order</label><input id={`role-sort-${role.role_id}`} name="sortOrder" type="number" step="1" defaultValue={role.sort_order} /></div></div>
                                  <CompanyPermissionPicker resources={administration.resources} selectedResourceIds={role.allowed_resources} label={`${role.name} permissions`} />
                                  <div><button className="button" type="submit">Save role</button></div>
                                </form>
                                <form className="danger-zone" action={deletePortalRoleAction}><input type="hidden" name="roleId" value={role.role_id} /><div className="field"><label htmlFor={`delete-role-${role.role_id}`}>Type {role.name} to delete</label><input id={`delete-role-${role.role_id}`} name="confirmRoleName" autoComplete="off" required /></div><button className="button button-danger" type="submit" disabled={role.user_count > 0}>Delete role</button>{role.user_count > 0 ? <p className="muted small-text">This role still has assigned users.</p> : null}</form>
                              </div></details>
                            ) : <span className="muted small-text">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="muted">No saved roles are currently available for this company.</p>}
            </section>
          ) : null}
        </section>
      ) : null}

      {administration ? (
        <details className={styles.accessDetails}>
          <summary>Your access</summary>
          <div className={styles.accessBody}>
            <p className={styles.accessIntro}>These permissions are controlled by your company account and determine which management tools are available here.</p>
            <div className={styles.permissionGrid}>
              {accessItems.map(([label, enabled]) => (
                <div className={styles.permission} key={label}>
                  <span>{label}</span>
                  <span className={`${styles.permissionState}${enabled ? "" : ` ${styles.permissionOff}`}`}>{enabled ? "Available" : "Not available"}</span>
                </div>
              ))}
            </div>
          </div>
        </details>
      ) : context.selected_company_id !== null ? (
        <section className={styles.emptyState}>
          <div><p className="eyebrow">Company access</p><h2>No company-management tools are available</h2></div>
          <p>You can still use the company services shown above. Additional management areas appear when your account is authorized for them.</p>
        </section>
      ) : null}
    </div>
  );
}
