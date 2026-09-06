import Link from "next/link";
import { notFound } from "next/navigation";
import { CompanyPermissionPicker } from "@/components/company-permission-picker";
import { getCompany } from "@/lib/graphql/companies";
import {
  getCompanyCustomerCandidates,
  getCompanyManagement,
  type CompanyAdminUser,
  type CompanyManagement,
} from "@/lib/graphql/company-management";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import {
  addCompanyUserAction,
  deleteCompanyRoleAction,
  removeCompanyUserAction,
  saveCompanyRoleAction,
  updateCompanyUserAction,
} from "./actions";

const approvalTypeOptions = [
  { value: "all", label: "All" },
  { value: "template", label: "Template" },
  { value: "value", label: "Value" },
  { value: "none", label: "None" },
] as const;

function userName(user: Pick<CompanyAdminUser, "firstname" | "lastname">) {
  return `${user.firstname} ${user.lastname}`.trim();
}

function approvalSummary(user: CompanyAdminUser) {
  const threshold = user.approval_threshold === null ? "" : ` · threshold ${user.approval_threshold}`;
  return `${user.approval_type}${threshold}`;
}

function ApprovalTypeSelect({ id, defaultValue = "all" }: { id?: string; defaultValue?: string }) {
  return (
    <select id={id} name="approvalType" defaultValue={defaultValue} required>
      {approvalTypeOptions.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function loadManagement(companyId: number, candidateSearch?: string) {
  try {
    const [company, management, candidates] = await Promise.all([
      getCompany(companyId),
      getCompanyManagement(companyId),
      getCompanyCustomerCandidates(companyId, 1, 50, candidateSearch),
    ]);

    return { company, management, candidates, error: null };
  } catch (error) {
    return { company: null, management: null, candidates: null, error: graphQLErrorMessage(error) };
  }
}

function ManagementStats({ management }: { management: CompanyManagement }) {
  const assignableResources = management.resources.filter((resource) => resource.assignable).length;

  return (
    <div className="stat-grid">
      <div className="stat-card"><span className="stat-value">{management.users.length}</span><span className="stat-label">Company users</span></div>
      <div className="stat-card"><span className="stat-value">{management.roles.length}</span><span className="stat-label">Roles</span></div>
      <div className="stat-card"><span className="stat-value">{assignableResources}</span><span className="stat-label">Assignable permissions</span></div>
    </div>
  );
}

function resourcePathMap(management: CompanyManagement) {
  const byId = new Map(management.resources.map((resource) => [resource.resource_id, resource]));
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

  management.resources.forEach((resource) => pathFor(resource.resource_id));
  return paths;
}

export default async function CompanyManagementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const companyId = Number(id);

  if (!Number.isInteger(companyId) || companyId <= 0) notFound();

  const candidateSearch = firstParam(query.candidateSearch)?.trim();
  const notice = firstParam(query.notice);
  const mutationError = firstParam(query.error);
  const { company, management, candidates, error } = await loadManagement(companyId, candidateSearch);

  if (!company || !management || !candidates) {
    return (
      <div className="stack">
        <div><Link className="back-link" href={`/companies/${companyId}`}>← Company detail</Link></div>
        <section className="card stack">
          <div><p className="eyebrow">Backend request failed</p><h1>Company management unavailable</h1></div>
          <div className="error">{error}</div>
        </section>
      </div>
    );
  }

  const usersById = new Map(management.users.map((user) => [user.user_id, user]));
  const resourcePaths = resourcePathMap(management);
  const availableCandidates = candidates.items.filter((candidate) => !candidate.assigned_to_company);

  return (
    <div className="stack section-gap">
      <div className="breadcrumbs">
        <Link href="/companies">Companies</Link><span aria-hidden="true">/</span>
        <Link href={`/companies/${company.company_id}`}>{company.name}</Link><span aria-hidden="true">/</span><span>Users & roles</span>
      </div>

      <header className="page-header">
        <div>
          <p className="eyebrow">{company.reference || `Company ${company.company_id}`}</p>
          <h1>Users & roles</h1>
          <p className="muted">Maintain company membership, approval settings and Fluid role permissions for {company.name}.</p>
        </div>
      </header>

      {notice ? <div className="notice">{notice}</div> : null}
      {mutationError ? <div className="error">{mutationError}</div> : null}

      <ManagementStats management={management} />

      <nav className="management-jump-nav" aria-label="Company management sections">
        <a href="#users">Users <span>{management.users.length}</span></a>
        <a href="#roles">Roles <span>{management.roles.length}</span></a>
      </nav>

      <section className="stack management-section" id="users">
        <div className="section-heading">
          <div><p className="eyebrow">Membership</p><h2>Company users</h2><p className="muted">Role, manager and approval changes are submitted directly to Fluid admin mutations.</p></div>
        </div>

        <details className="card management-create-panel" open={Boolean(candidateSearch)}>
          <summary><span><strong>Add company user</strong><small>Find an existing Magento customer and assign a company role.</small></span></summary>
          <div className="management-panel-body stack">
            <form className="inline-form" method="get">
              <div className="field grow"><label htmlFor="candidateSearch">Customer search</label><input id="candidateSearch" name="candidateSearch" defaultValue={candidateSearch} placeholder="Name or email" /></div>
              <button className="button button-secondary" type="submit">Search</button>
            </form>
            <form action={addCompanyUserAction} className="form-grid">
              <input name="companyId" type="hidden" value={company.company_id} />
              <div className="field span-2"><label htmlFor="customerId">Customer</label><select id="customerId" name="customerId" required defaultValue=""><option value="" disabled>Select a customer</option>{availableCandidates.map((candidate) => <option key={candidate.customer_id} value={candidate.customer_id}>{candidate.firstname} {candidate.lastname} · {candidate.email} · #{candidate.customer_id}</option>)}</select></div>
              <div className="field"><label htmlFor="newRoleId">Role</label><select id="newRoleId" name="roleId" required defaultValue=""><option value="" disabled>Select role</option>{management.roles.map((role) => <option key={role.role_id} value={role.role_id}>{role.name}</option>)}</select></div>
              <div className="field"><label htmlFor="newManagerId">Manager</label><select id="newManagerId" name="managerId" defaultValue=""><option value="">No manager</option>{management.users.map((user) => <option key={user.user_id} value={user.user_id}>{userName(user)}</option>)}</select></div>
              <div className="field"><label htmlFor="newApprovalType">Approval type</label><ApprovalTypeSelect id="newApprovalType" /></div>
              <div className="field"><label htmlFor="newApprovalThreshold">Approval threshold</label><input id="newApprovalThreshold" name="approvalThreshold" type="number" min="0" step="0.01" /></div>
              <div className="span-2 button-row"><button className="button" type="submit" disabled={!availableCandidates.length || !management.roles.length}>Add company user</button><span className="muted small-text">Showing {candidates.items.length} of {candidates.total_count} matching candidates; assigned customers are omitted.</span></div>
            </form>
          </div>
        </details>

        <div className="table-wrap management-table">
          <table><thead><tr><th>User</th><th>Role</th><th>Manager</th><th>Approval</th><th>Capabilities</th><th>Manage</th></tr></thead>
            <tbody>
              {management.users.map((user) => {
                const manager = user.manager_user_id === null ? null : usersById.get(user.manager_user_id);
                const selectedRoleId = user.roles[0]?.role_id;
                return (
                  <tr key={user.user_id}>
                    <td><div className="cell-stack"><strong>{userName(user)}</strong><span className="muted small-text">{user.email}</span>{user.is_company_admin ? <span className="badge badge-ok">Company admin</span> : null}</div></td>
                    <td>{user.roles.length ? user.roles.map((role) => role.name).join(", ") : "No assigned role"}</td>
                    <td>{manager ? userName(manager) : user.manager_user_id === null ? "—" : `User #${user.manager_user_id}`}</td>
                    <td>{approvalSummary(user)}</td>
                    <td><div className="capability-list"><span>{user.can_checkout ? "✓" : "—"} Checkout</span><span>{user.can_approve_credit_orders ? "✓" : "—"} Credit approval</span><span>{user.can_auto_approve_credit_order ? "✓" : "—"} Auto-approve</span></div></td>
                    <td>
                      <details className="mutation-panel management-edit-panel"><summary>Edit</summary>
                        <div className="management-edit-body">
                          <form action={updateCompanyUserAction} className="compact-form">
                            <input name="companyId" type="hidden" value={company.company_id} /><input name="userId" type="hidden" value={user.user_id} />
                            <div className="field"><label>Role</label><select name="roleId" required defaultValue={selectedRoleId ?? ""}><option value="" disabled>Select role</option>{management.roles.map((role) => <option key={role.role_id} value={role.role_id}>{role.name}</option>)}</select></div>
                            <div className="field"><label>Manager</label><select name="managerId" defaultValue={user.manager_user_id ?? ""}><option value="">No manager</option>{management.users.filter((candidate) => candidate.user_id !== user.user_id).map((candidate) => <option key={candidate.user_id} value={candidate.user_id}>{userName(candidate)}</option>)}</select></div>
                            <div className="field"><label>Approval type</label><ApprovalTypeSelect defaultValue={user.approval_type} /></div>
                            <div className="field"><label>Approval threshold</label><input name="approvalThreshold" type="number" min="0" step="0.01" defaultValue={user.approval_threshold ?? ""} /></div>
                            <button className="button" type="submit">Save user</button>
                          </form>
                          {!user.is_company_admin ? <form action={removeCompanyUserAction} className="danger-zone"><input name="companyId" type="hidden" value={company.company_id} /><input name="userId" type="hidden" value={user.user_id} /><input name="expectedEmail" type="hidden" value={user.email} /><div className="field"><label>Type {user.email} to remove</label><input name="confirmEmail" autoComplete="off" required /></div><button className="button button-danger" type="submit">Remove user</button></form> : <p className="muted small-text">Company administrators cannot be removed by this mutation.</p>}
                        </div>
                      </details>
                    </td>
                  </tr>
                );
              })}
              {!management.users.length ? <tr><td colSpan={6}>No company users were returned.</td></tr> : null}
            </tbody></table>
        </div>
      </section>

      <section className="stack management-section" id="roles">
        <div className="section-heading">
          <div><p className="eyebrow">Access control</p><h2>Company roles</h2><p className="muted">Permission titles and assignability come directly from Fluid. Protected resources remain preserved automatically.</p></div>
        </div>

        <details className="card management-create-panel">
          <summary><span><strong>Create role</strong><small>Choose only the permission groups this role should receive.</small></span></summary>
          <form action={saveCompanyRoleAction} className="management-panel-body stack">
            <input name="companyId" type="hidden" value={company.company_id} />
            <div className="form-grid"><div className="field"><label htmlFor="roleName">Role name</label><input id="roleName" name="name" required /></div><div className="field"><label htmlFor="roleSort">Sort order</label><input id="roleSort" name="sortOrder" type="number" /></div></div>
            <CompanyPermissionPicker resources={management.resources} label="Role permissions" />
            <div><button className="button" type="submit">Create role</button></div>
          </form>
        </details>

        <div className="table-wrap management-table">
          <table>
            <thead><tr><th>Role</th><th>Users</th><th>Sort</th><th>Permissions</th><th>Manage</th></tr></thead>
            <tbody>
              {management.roles.map((role) => (
                <tr key={role.role_id}>
                  <td><div className="cell-stack"><strong>{role.name}</strong><span className={`badge ${role.manageable ? "badge-ok" : "badge-neutral"}`}>{role.manageable ? "Manageable" : "Protected"}</span></div></td>
                  <td>{role.user_count}</td>
                  <td>{role.sort_order}</td>
                  <td>
                    <details className="resource-details compact-resource-summary">
                      <summary>{role.allowed_resources.length} assigned</summary>
                      {role.allowed_resources.length ? <ul className="compact-list">{role.allowed_resources.map((resourceId) => <li key={resourceId}>{resourcePaths.get(resourceId) ?? resourceId}</li>)}</ul> : <p className="muted small-text">No explicit resources returned.</p>}
                    </details>
                  </td>
                  <td>
                    {role.manageable ? (
                      <details className="mutation-panel management-edit-panel"><summary>Edit</summary>
                        <div className="management-edit-body role-edit-body">
                          <form action={saveCompanyRoleAction} className="stack">
                            <input name="companyId" type="hidden" value={company.company_id} /><input name="roleId" type="hidden" value={role.role_id} />
                            <div className="form-grid"><div className="field"><label>Name</label><input name="name" defaultValue={role.name} required /></div><div className="field"><label>Sort order</label><input name="sortOrder" type="number" defaultValue={role.sort_order} /></div></div>
                            <CompanyPermissionPicker resources={management.resources} selectedResourceIds={role.allowed_resources} label={`${role.name} permissions`} />
                            <div><button className="button" type="submit">Save role</button></div>
                          </form>
                          <form action={deleteCompanyRoleAction} className="danger-zone"><input name="companyId" type="hidden" value={company.company_id} /><input name="roleId" type="hidden" value={role.role_id} /><input name="expectedName" type="hidden" value={role.name} /><div className="field"><label>Type {role.name} to delete</label><input name="confirmName" autoComplete="off" required /></div><button className="button button-danger" type="submit" disabled={role.user_count > 0}>Delete role</button>{role.user_count > 0 ? <p className="muted small-text">Fluid only deletes unused roles; this role currently has users.</p> : null}</form>
                        </div>
                      </details>
                    ) : <span className="muted small-text">Protected by Fluid</span>}
                  </td>
                </tr>
              ))}
              {!management.roles.length ? <tr><td colSpan={5}>No company roles were returned.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
