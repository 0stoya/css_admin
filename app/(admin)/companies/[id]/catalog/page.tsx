import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompany } from "@/lib/graphql/companies";
import { getCompanyManagement } from "@/lib/graphql/company-management";
import {
  getCompanyCatalogPolicy,
  getRoleCatalogPolicy,
  type CompanyCatalogPolicy,
  type RoleCatalogCategoryNode,
  type RoleCatalogPolicy,
} from "@/lib/graphql/catalog-policy";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import {
  saveCompanyCatalogPolicyAction,
  saveRoleCategoriesAction,
  saveRoleProductsAction,
} from "./actions";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function positivePage(value: string | undefined) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function categoryFields(
  nodes: RoleCatalogCategoryNode[],
  selected: Set<number>,
  depth = 0,
): React.ReactNode {
  return nodes.map((node) => (
    <div key={node.id}>
      <label className="catalog-tree-option" style={{ paddingLeft: `${depth * 1.1}rem` }}>
        <input
          name="categoryIds"
          type="checkbox"
          value={node.id}
          defaultChecked={selected.has(node.id)}
        />
        <span>{node.label}</span>
        <span className="muted small-text">#{node.id}</span>
      </label>
      {categoryFields(node.children ?? [], selected, depth + 1)}
    </div>
  ));
}

function flattenCategoryIds(nodes: RoleCatalogCategoryNode[]): number[] {
  const ids: number[] = [];
  for (const node of nodes) {
    if (node.id > 0) ids.push(node.id);
    ids.push(...flattenCategoryIds(node.children ?? []));
  }
  return Array.from(new Set(ids));
}

async function loadCompanyCatalog(companyId: number) {
  try {
    const [company, policy] = await Promise.all([
      getCompany(companyId),
      getCompanyCatalogPolicy(companyId),
    ]);
    return { company, policy, error: null };
  } catch (error) {
    return { company: null, policy: null, error: graphQLErrorMessage(error) };
  }
}

async function loadRoleContext(companyId: number) {
  try {
    return { management: await getCompanyManagement(companyId), error: null };
  } catch (error) {
    return { management: null, error: graphQLErrorMessage(error) };
  }
}

async function loadRolePolicy(
  companyId: number,
  roleId: number,
  page: number,
  search?: string,
) {
  try {
    return {
      policy: await getRoleCatalogPolicy(companyId, roleId, page, search),
      error: null,
    };
  } catch (error) {
    return { policy: null, error: graphQLErrorMessage(error) };
  }
}

function CompanyPolicySummary({ policy }: { policy: CompanyCatalogPolicy }) {
  return (
    <div className="stat-grid">
      <div className="stat-card"><span className="stat-value">{policy.allow_public_catalog ? "Yes" : "No"}</span><span className="stat-label">Public catalogue</span></div>
      <div className="stat-card"><span className="stat-value">{policy.allowed_category_ids.length}</span><span className="stat-label">Allowed categories</span></div>
      <div className="stat-card"><span className="stat-value">{policy.allowed_product_ids.length}</span><span className="stat-label">Allowed products</span></div>
    </div>
  );
}

function productPageHref(companyId: number, roleId: number, page: number, search?: string) {
  const params = new URLSearchParams({ roleId: String(roleId), rolePage: String(page) });
  if (search) params.set("roleProductSearch", search);
  return `/companies/${companyId}/catalog?${params.toString()}`;
}

export default async function CompanyCatalogPage({
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

  const notice = firstParam(query.notice);
  const mutationError = firstParam(query.error);
  const requestedRoleId = Number(firstParam(query.roleId) ?? 0);
  const rolePage = positivePage(firstParam(query.rolePage));
  const roleProductSearch = firstParam(query.roleProductSearch)?.trim();

  const [{ company, policy, error }, roleContext] = await Promise.all([
    loadCompanyCatalog(companyId),
    loadRoleContext(companyId),
  ]);

  if (!company || !policy) {
    return (
      <div className="stack">
        <div><Link className="back-link" href={`/companies/${companyId}`}>← Company detail</Link></div>
        <section className="card stack">
          <div><p className="eyebrow">Backend request failed</p><h1>Catalogue policy unavailable</h1></div>
          <div className="error">{error}</div>
        </section>
      </div>
    );
  }

  const roles = roleContext.management?.roles ?? [];
  const requestedRole = Number.isInteger(requestedRoleId) && requestedRoleId > 0
    ? roles.find((role) => role.role_id === requestedRoleId)
    : undefined;
  const selectedRole = requestedRole ?? roles[0];

  let rolePolicy: RoleCatalogPolicy | null = null;
  let rolePolicyError = roleContext.error;
  if (selectedRole && !rolePolicyError) {
    const result = await loadRolePolicy(
      companyId,
      selectedRole.role_id,
      rolePage,
      roleProductSearch,
    );
    rolePolicy = result.policy;
    rolePolicyError = result.error;
  }

  const totalProductPages = rolePolicy
    ? Math.max(1, Math.ceil(rolePolicy.products.total_count / rolePolicy.products.page_size))
    : 1;

  const allRoleCategoryIds = rolePolicy ? flattenCategoryIds(rolePolicy.category_tree) : [];
  const selectedCategoryIds = new Set(rolePolicy?.selected_category_ids ?? []);
  const usesAllCompanyCategories = allRoleCategoryIds.length > 0
    && allRoleCategoryIds.every((categoryId) => selectedCategoryIds.has(categoryId));
  const roleAllowedProductIds = new Set(rolePolicy?.allowed_product_ids ?? []);
  const canUseCompanyProductChecklist = Boolean(
    rolePolicy
    && rolePolicy.has_saved_categories
    && usesAllCompanyCategories
    && policy.product_restriction,
  );

  return (
    <div className="stack section-gap">
      <div className="breadcrumbs">
        <Link href="/companies">Companies</Link><span aria-hidden="true">/</span>
        <Link href={`/companies/${company.company_id}`}>{company.name}</Link><span aria-hidden="true">/</span>
        <span>Catalogue policy</span>
      </div>

      <header className="page-header">
        <div>
          <p className="eyebrow">Company {company.company_id}</p>
          <h1>Catalogue policy</h1>
          <p className="muted">Company and role catalogue visibility returned by Fluid for {company.name}.</p>
        </div>
      </header>

      {notice ? <div className="notice">{notice}</div> : null}
      {mutationError ? <div className="error">{mutationError}</div> : null}

      <CompanyPolicySummary policy={policy} />

      <section className="stack">
        <div className="section-heading"><div><h2>Company catalogue</h2><p className="muted">Company-level public, category and product restrictions.</p></div></div>

        <form action={saveCompanyCatalogPolicyAction} className="card stack">
          <input name="companyId" type="hidden" value={company.company_id} />
          <div className="form-grid">
            <label className="check-field"><input name="allowPublicCatalog" type="checkbox" defaultChecked={policy.allow_public_catalog} /><span><strong>Allow public catalogue</strong><span className="muted small-text">Expose the public catalogue according to Fluid company policy.</span></span></label>
            <label className="check-field"><input name="categoryRestriction" type="checkbox" defaultChecked={policy.category_restriction} /><span><strong>Restrict categories</strong><span className="muted small-text">Apply the category ID list below.</span></span></label>
            <label className="check-field"><input name="productRestriction" type="checkbox" defaultChecked={policy.product_restriction} /><span><strong>Restrict products</strong><span className="muted small-text">Apply the product SKU list below.</span></span></label>
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="allowedCategoryIds">Allowed category IDs</label>
              <textarea id="allowedCategoryIds" name="allowedCategoryIds" rows={6} defaultValue={policy.allowed_category_ids.join(", ")} />
              <span className="muted small-text">Comma or whitespace separated. Fluid validates every category ID.</span>
            </div>
            <div className="field">
              <label htmlFor="allowedProductSkus">Allowed product SKUs</label>
              <textarea id="allowedProductSkus" name="allowedProductSkus" rows={6} defaultValue={policy.allowed_products.map((product) => product.sku).join("\n")} />
              <span className="muted small-text">One per line or comma separated. Fluid resolves every SKU.</span>
            </div>
          </div>
          <button className="button" type="submit">Save company catalogue policy</button>
        </form>

        <div className="grid">
          <article className="card stack">
            <h3>Current allowed categories</h3>
            {policy.allowed_categories.length ? <ul className="compact-list">{policy.allowed_categories.map((category) => <li key={category.category_id}>{category.name} · #{category.category_id} <span className="muted small-text">{category.path}</span></li>)}</ul> : <p className="muted">No explicit category IDs are stored.</p>}
          </article>
          <article className="card stack">
            <h3>Current allowed products</h3>
            {policy.allowed_products.length ? <ul className="compact-list">{policy.allowed_products.map((product) => <li key={product.product_id}>{product.name} · <code>{product.sku}</code> · #{product.product_id}</li>)}</ul> : <p className="muted">No explicit product IDs are stored.</p>}
          </article>
        </div>
      </section>

      <section className="stack">
        <div className="section-heading"><div><h2>Role catalogue</h2><p className="muted">Role visibility is always a subset of the company catalogue and remains validated by Fluid.</p></div></div>

        {!roleContext.management ? (
          <div className="error">{rolePolicyError || "Company roles are unavailable in this admin context."}</div>
        ) : roles.length === 0 ? (
          <div className="card muted">No company roles are available.</div>
        ) : (
          <>
            <form className="card inline-form" method="get">
              <div className="field grow">
                <label htmlFor="roleId">Company role</label>
                <select id="roleId" name="roleId" defaultValue={selectedRole?.role_id}>
                  {roles.map((role) => <option key={role.role_id} value={role.role_id}>{role.name} · #{role.role_id}{role.manageable ? "" : " · protected"}</option>)}
                </select>
              </div>
              <button className="button button-secondary" type="submit">Load role policy</button>
            </form>

            {rolePolicyError || !rolePolicy || !selectedRole ? (
              <div className="error">{rolePolicyError || "Role catalogue policy is unavailable."}</div>
            ) : (
              <>
                <div className="stat-grid">
                  <div className="stat-card"><span className="stat-value">{usesAllCompanyCategories ? "All" : rolePolicy.selected_category_ids.length}</span><span className="stat-label">Role categories</span></div>
                  <div className="stat-card"><span className="stat-value">{rolePolicy.products_count}</span><span className="stat-label">Products in scope</span></div>
                  <div className="stat-card"><span className="stat-value">{rolePolicy.preselect_all_products ? "All" : rolePolicy.allowed_product_ids.length}</span><span className="stat-label">Allowed products</span></div>
                </div>

                <section className="card stack">
                  <div className="card-heading-row">
                    <div><p className="eyebrow">{selectedRole.name}</p><h3>Category visibility</h3></div>
                    <span className={`badge ${usesAllCompanyCategories ? "badge-ok" : "badge-neutral"}`}>{usesAllCompanyCategories ? "No extra category restriction" : "Restricted categories"}</span>
                  </div>
                  <p className="muted">Fluid requires category state before product state. Choosing all company categories satisfies that backend requirement without adding a role-level category restriction.</p>

                  <form action={saveRoleCategoriesAction} className="card stack nested-card">
                    <input name="companyId" type="hidden" value={company.company_id} />
                    <input name="roleId" type="hidden" value={selectedRole.role_id} />
                    {allRoleCategoryIds.map((categoryId) => <input key={categoryId} name="categoryIds" type="hidden" value={categoryId} />)}
                    <div><strong>Use all company categories</strong><p className="muted small-text">Recommended when this role should only narrow products, not categories.</p></div>
                    <button className="button button-secondary" type="submit">Use all company categories</button>
                  </form>

                  <details className="mutation-panel">
                    <summary>Restrict categories for this role</summary>
                    <form action={saveRoleCategoriesAction} className="stack compact-form">
                      <input name="companyId" type="hidden" value={company.company_id} />
                      <input name="roleId" type="hidden" value={selectedRole.role_id} />
                      <div className="catalog-tree">{categoryFields(rolePolicy.category_tree, selectedCategoryIds)}</div>
                      <button className="button" type="submit">Save selected categories</button>
                    </form>
                  </details>
                </section>

                <section className="card stack">
                  <div><h3>Product visibility</h3><p className="muted">Role products cannot broaden the company catalogue. Product writes remain backend validated.</p></div>

                  {!rolePolicy.has_saved_categories ? (
                    <div className="card stack nested-card">
                      <p className="muted">Product controls are disabled until Fluid has saved category state for this role.</p>
                      <form action={saveRoleCategoriesAction} className="stack">
                        <input name="companyId" type="hidden" value={company.company_id} />
                        <input name="roleId" type="hidden" value={selectedRole.role_id} />
                        {allRoleCategoryIds.map((categoryId) => <input key={categoryId} name="categoryIds" type="hidden" value={categoryId} />)}
                        <button className="button" type="submit">Use company categories and enable products</button>
                      </form>
                    </div>
                  ) : canUseCompanyProductChecklist ? (
                    <form action={saveRoleProductsAction} className="stack">
                      <input name="companyId" type="hidden" value={company.company_id} />
                      <input name="roleId" type="hidden" value={selectedRole.role_id} />
                      <input name="productMode" type="hidden" value="explicit" />
                      <div className="resource-picker">
                        {policy.allowed_products.map((product) => (
                          <label className="resource-option" key={product.product_id}>
                            <input
                              name="allowedProductIds"
                              type="checkbox"
                              value={product.product_id}
                              defaultChecked={rolePolicy.preselect_all_products || roleAllowedProductIds.has(product.product_id)}
                            />
                            <span><strong>{product.name}</strong> <span className="muted small-text"><code>{product.sku}</code> · #{product.product_id}</span></span>
                          </label>
                        ))}
                        {policy.allowed_products.length === 0 ? <p className="muted">The company currently has no explicitly allowed products.</p> : null}
                      </div>
                      <p className="muted small-text">Only products already allowed for the company are offered here. Uncheck to remove from the role; check to add back.</p>
                      <button className="button" type="submit">Save role products</button>
                    </form>
                  ) : (
                    <div className="grid">
                      <form action={saveRoleProductsAction} className="card stack nested-card">
                        <input name="companyId" type="hidden" value={company.company_id} />
                        <input name="roleId" type="hidden" value={selectedRole.role_id} />
                        <input name="productMode" type="hidden" value="all" />
                        <div><strong>Allow all products in role categories</strong><p className="muted small-text">Useful when the company catalogue is not explicitly product restricted.</p></div>
                        <button className="button button-secondary" type="submit">Use all products</button>
                      </form>

                      <form action={saveRoleProductsAction} className="card stack nested-card">
                        <input name="companyId" type="hidden" value={company.company_id} />
                        <input name="roleId" type="hidden" value={selectedRole.role_id} />
                        <input name="productMode" type="hidden" value="explicit" />
                        <div className="field">
                          <label htmlFor={`allowedProductIds-${selectedRole.role_id}`}>Explicit allowed product IDs</label>
                          <textarea id={`allowedProductIds-${selectedRole.role_id}`} name="allowedProductIds" rows={5} defaultValue={rolePolicy.allowed_product_ids.join(", ")} />
                        </div>
                        <button className="button" type="submit">Save explicit product IDs</button>
                      </form>
                    </div>
                  )}

                  {rolePolicy.show_product_grid ? (
                    <div className="stack">
                      <form className="inline-form" method="get">
                        <input name="roleId" type="hidden" value={selectedRole.role_id} />
                        <div className="field grow"><label htmlFor="roleProductSearch">Product search</label><input id="roleProductSearch" name="roleProductSearch" defaultValue={roleProductSearch} placeholder="SKU or product name" /></div>
                        <button className="button button-secondary" type="submit">Search products</button>
                      </form>

                      <div className="table-wrap">
                        <table>
                          <thead><tr><th>Product</th><th>SKU</th><th>ID</th><th>Allowed</th></tr></thead>
                          <tbody>
                            {rolePolicy.products.items.map((product) => <tr key={product.id}><td>{product.name}</td><td><code>{product.sku}</code></td><td>{product.id}</td><td><span className={`badge ${product.allowed ? "badge-ok" : "badge-neutral"}`}>{product.allowed ? "Yes" : "No"}</span></td></tr>)}
                            {rolePolicy.products.items.length === 0 ? <tr><td colSpan={4}>No products match this role/search.</td></tr> : null}
                          </tbody>
                        </table>
                      </div>

                      <div className="pagination-row">
                        <span className="muted small-text">Page {rolePolicy.products.page} of {totalProductPages} · {rolePolicy.products.total_count} products</span>
                        <div className="pagination-actions">
                          {rolePolicy.products.page > 1 ? <Link className="button button-secondary button-link" href={productPageHref(company.company_id, selectedRole.role_id, rolePolicy.products.page - 1, roleProductSearch)}>Previous</Link> : null}
                          {rolePolicy.products.page < totalProductPages ? <Link className="button button-secondary button-link" href={productPageHref(company.company_id, selectedRole.role_id, rolePolicy.products.page + 1, roleProductSearch)}>Next</Link> : null}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </section>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
