import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompany } from "@/lib/graphql/companies";
import {
  getCompanyCustomerCandidates,
  getCompanyManagement,
  type CompanyAdminRole,
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
      <div className="stat-card"><span className="stat-value">{assignableResources}</span><span className="stat-label">Assignable resources</span></div>
    </div>
  );
}

function RoleResourceFields({ role, management }: { role?: CompanyAdminRole; management: CompanyManagement }) {
  return (
    <div className="resource-picker">
      {management.resources.map((resource) => {
        const checked = role?.allowed_resources.includes(resource.resource_id) ?? false;
        return (
          <label className="resource-option" key={resource.resource_id} style={{ paddingLeft: `${resource.depth * 1.1}rem` }}>
            {resource.assignable ? (
              <input name="allowedResources" type="checkbox" value={resource.resource_id} defaultChecked={checked} />
            ) : (
              <>
                <input type="checkbox" checked={checked} disabled readOnly />
                {checked ? <input name="allowedResources" type="hidden" value={resource.resource_id} /> : null}
              </>
            )}
            <span>{resource.title}</span>
            {!resource.assignable ? <span className="muted small-text">protected</span> : null}
          </label>
        );
      })}
    </div>
  );
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
  const resourcesById = new Map(management.resources.map((resource) => [resource.resource_id, resource]));
  const availableCandidates = candidates.items.filter((candidate) => !candidate.assigned_to_company);

  return (
    <div className="stack section-gap">
      <div className="breadcrumbs">
        <Link href="/companies">Companies</Link><span aria-hidden="true">/</span>
        <Link href={`/companies/${company.company_id}`}>{company.name}</Link><span aria-hidden="true">/</span><span>Management</span>
      </div>

      <header className="page-header">
        <div>
          <p className="eyebrow">Company {company.company_id}</p>
          <h1>Company management</h1>
          <p className="muted">Users, roles and company ACL resources returned by Fluid for {company.name}.</p>
        </div>
      </header>

      {notice ? <div className="notice">{notice}</div> : null}
      {mutationError ? <div className="error">{mutationError}</div> : null}

      <ManagementStats management={management} />

      <section className="stack">
        <div className="section-heading"><div><h2>Add company user</h2><p className="muted">Search Magento customer candidates, then assign one Fluid company role.</p></div></div>
        <div className="card stack">
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
            <div className="span-2"><button className="button" type="submit" disabled={!availableCandidates.length || !management.roles.length}>Add company user</button></div>
          </form>
          <p className="muted small-text">Showing {candidates.items.length} of {candidates.total_count} matching candidates. Already assigned customers are omitted from the selector.</p>
        </div>
      </section>

      <section className="stack">
        <div className="section-heading"><div><h2>Users</h2><p className="muted">Membership and approval changes are submitted directly to Fluid admin mutations.</p></div></div>
        <div className="table-wrap">
          <table><thead><tr><th>User</th><th>Roles</th><th>Manager</th><th>Approval</th><th>Capabilities</th><th>Actions</th></tr></thead>
            <tbody>
              {management.users.map((user) => {
                const manager = user.manager_user_id === null ? null : usersById.get(user.manager_user_id);
                const selectedRoleId = user.roles[0]?.role_id;
                return (
                  <tr key={user.user_id}>
                    <td><div className="cell-stack"><strong>{userName(user)}</strong><span className="muted small-text">{user.email}</span><span className="muted small-text">User #{user.user_id} · Customer #{user.customer_id}</span>{user.is_company_admin ? <span className="badge badge-ok">Company admin</span> : null}</div></td>
                    <td>{user.roles.length ? user.roles.map((role) => role.name).join(", ") : "No assigned role"}</td>
                    <td>{manager ? userName(manager) : user.manager_user_id === null ? "—" : `User #${user.manager_user_id}`}</td>
                    <td>{approvalSummary(user)}</td>
                    <td><div className="capability-list"><span>{user.can_checkout ? "✓" : "—"} Checkout</span><span>{user.can_approve_credit_orders ? "✓" : "—"} Credit approval</span><span>{user.can_auto_approve_credit_order ? "✓" : "—"} Auto-approve</span></div></td>
                    <td>
                      <details className="mutation-panel"><summary>Edit</summary>
                        <form action={updateCompanyUserAction} className="compact-form">
                          <input name="companyId" type="hidden" value={company.company_id} /><input name="userId" type="hidden" value={user.user_id} />
                          <div className="field"><label>Role</label><select name="roleId" required defaultValue={selectedRoleId ?? ""}><option value="" disabled>Select role</option>{management.roles.map((role) => <option key={role.role_id} value={role.role_id}>{role.name}</option>)}</select></div>
                          <div className="field"><label>Manager</label><select name="managerId" defaultValue={user.manager_user_id ?? ""}><option value="">No manager</option>{management.users.filter((candidate) => candidate.user_id !== user.user_id).map((candidate) => <option key={candidate.user_id} value={candidate.user_id}>{userName(candidate)}</option>)}</select></div>
                          <div className="field"><label>Approval type</label><ApprovalTypeSelect defaultValue={user.approval_type} /></div>
                          <div className="field"><label>Approval threshold</label><input name="approvalThreshold" type="number" min="0" step="0.01" defaultValue={user.approval_threshold ?? ""} /></div>
                          <button className="button" type="submit">Save user</button>
                        </form>
                        {!user.is_company_admin ? <form action={removeCompanyUserAction} className="danger-zone"><input name="companyId" type="hidden" value={company.company_id} /><input name="userId" type="hidden" value={user.user_id} /><input name="expectedEmail" type="hidden" value={user.email} /><div className="field"><label>Type {user.email} to remove</label><input name="confirmEmail" autoComplete="off" required /></div><button className="button button-danger" type="submit">Remove user</button></form> : <p className="muted small-text">Company administrators cannot be removed by this mutation.</p>}
                      </details>
                    </td>
                  </tr>
                );
              })}
              {!management.users.length ? <tr><td colSpan={6}>No company users were returned.</td></tr> : null}
            </tbody></table>
        </div>
      </section>

      <section className="stack">
        <div className="section-heading"><div><h2>Create role</h2><p className="muted">Only resources marked assignable by Fluid can be selected.</p></div></div>
        <form action={saveCompanyRoleAction} className="card stack">
          <input name="companyId" type="hidden" value={company.company_id} />
          <div className="form-grid"><div className="field"><label htmlFor="roleName">Role name</label><input id="roleName" name="name" required /></div><div className="field"><label htmlFor="roleSort">Sort order</label><input id="roleSort" name="sortOrder" type="number" /></div></div>
          <RoleResourceFields management={management} />
          <button className="button" type="submit">Create role</button>
        </form>
      </section>

      <section className="stack">
        <div className="section-heading"><div><h2>Roles</h2><p className="muted">Manageability and resource assignability come directly from Fluid.</p></div></div>
        <div className="grid">
          {management.roles.map((role) => (
            <article className="card stack" key={role.role_id}>
              <div className="card-heading-row"><div><p className="eyebrow">Role {role.role_id}</p><h3>{role.name}</h3></div><span className={`badge ${role.manageable ? "badge-ok" : "badge-neutral"}`}>{role.manageable ? "Manageable" : "Protected"}</span></div>
              <dl className="mini-detail-list"><dt>Users</dt><dd>{role.user_count}</dd><dt>Sort order</dt><dd>{role.sort_order}</dd><dt>Resources</dt><dd>{role.allowed_resources.length}</dd></dl>
              <details className="resource-details"><summary>View assigned resources</summary>{role.allowed_resources.length ? <ul className="compact-list">{role.allowed_resources.map((resourceId) => <li key={resourceId}>{resourcesById.get(resourceId)?.title ?? resourceId}</li>)}</ul> : <p className="muted small-text">No explicit resources returned.</p>}</details>
              {role.manageable ? <details className="mutation-panel"><summary>Edit role</summary>
                <form action={saveCompanyRoleAction} className="compact-form"><input name="companyId" type="hidden" value={company.company_id} /><input name="roleId" type="hidden" value={role.role_id} /><div className="field"><label>Name</label><input name="name" defaultValue={role.name} required /></div><div className="field"><label>Sort order</label><input name="sortOrder" type="number" defaultValue={role.sort_order} /></div><RoleResourceFields role={role} management={management} /><button className="button" type="submit">Save role</button></form>
                <form action={deleteCompanyRoleAction} className="danger-zone"><input name="companyId" type="hidden" value={company.company_id} /><input name="roleId" type="hidden" value={role.role_id} /><input name="expectedName" type="hidden" value={role.name} /><div className="field"><label>Type {role.name} to delete</label><input name="confirmName" autoComplete="off" required /></div><button className="button button-danger" type="submit" disabled={role.user_count > 0}>Delete role</button>{role.user_count > 0 ? <p className="muted small-text">Fluid only deletes unused roles; this role currently has users.</p> : null}</form>
              </details> : <p className="muted small-text">Fluid marks this role as protected.</p>}
            </article>
          ))}
        </div>
      </section>

      <section className="stack">
        <div className="section-heading"><div><h2>Resource tree</h2><p className="muted">Descriptive view only; permissions are not calculated in the frontend.</p></div></div>
        <div className="table-wrap"><table><thead><tr><th>Resource</th><th>ID</th><th>Assignable</th><th>Assigned roles</th></tr></thead><tbody>
          {management.resources.map((resource) => { const assignedRoles = management.roles.filter((role) => role.allowed_resources.includes(resource.resource_id)); return <tr key={resource.resource_id}><td><div className="resource-title" style={{ paddingLeft: `${resource.depth * 1.1}rem` }}>{resource.depth > 0 ? <span aria-hidden="true">↳ </span> : null}<strong>{resource.title}</strong></div></td><td><code>{resource.resource_id}</code></td><td><span className={`badge ${resource.assignable ? "badge-ok" : "badge-neutral"}`}>{resource.assignable ? "Yes" : "No"}</span></td><td>{assignedRoles.length ? assignedRoles.map((role) => role.name).join(", ") : "—"}</td></tr>; })}
        </tbody></table></div>
      </section>
    </div>
  );
}
