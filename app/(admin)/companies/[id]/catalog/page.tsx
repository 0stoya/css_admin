import Link from "next/link";
import { notFound } from "next/navigation";
import { CatalogCategoryPicker } from "@/components/catalog-category-picker";
import { CatalogProductPicker } from "@/components/catalog-product-picker";
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

async function loadRolePolicy(companyId: number, roleId: number, page: number, search?: string) {
  try {
    return { policy: await getRoleCatalogPolicy(companyId, roleId, page, search), error: null };
  } catch (error) {
    return { policy: null, error: graphQLErrorMessage(error) };
  }
}

function CompanyPolicySummary({ policy }: { policy: CompanyCatalogPolicy }) {
  return (
    <div className="stat-grid control-summary-grid">
      <div className="stat-card">
        <span className="stat-value">{policy.allow_public_catalog ? "On" : "Off"}</span>
        <span className="stat-label">Public catalogue</span>
      </div>
      <div className="stat-card">
        <span className="stat-value">{policy.category_restriction ? policy.allowed_category_ids.length : "All"}</span>
        <span className="stat-label">Company categories</span>
      </div>
      <div className="stat-card">
        <span className="stat-value">{policy.product_restriction ? policy.allowed_product_ids.length : "All"}</span>
        <span className="stat-label">Company products</span>
      </div>
    </div>
  );
}

function productPageHref(companyId: number, roleId: number, page: number, search?: string) {
  const params = new URLSearchParams({ roleId: String(roleId), rolePage: String(page) });
  if (search) params.set("roleProductSearch", search);
  return `/companies/${companyId}/catalog?${params.toString()}#role-products`;
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
    const result = await loadRolePolicy(companyId, selectedRole.role_id, rolePage, roleProductSearch);
    rolePolicy = result.policy;
    rolePolicyError = result.error;
  }

  const allRoleCategoryIds = rolePolicy ? flattenCategoryIds(rolePolicy.category_tree) : [];
  const selectedCategoryIds = new Set(rolePolicy?.selected_category_ids ?? []);
  const usesAllCompanyCategories = allRoleCategoryIds.length > 0
    && allRoleCategoryIds.every((categoryId) => selectedCategoryIds.has(categoryId));
  const canUseCompanyProductChecklist = Boolean(
    rolePolicy
    && rolePolicy.has_saved_categories
    && usesAllCompanyCategories
    && policy.product_restriction,
  );
  const totalProductPages = rolePolicy
    ? Math.max(1, Math.ceil(rolePolicy.products.total_count / rolePolicy.products.page_size))
    : 1;

  return (
    <div className="stack control-page">
      <div className="breadcrumbs">
        <Link href="/companies">Companies</Link><span aria-hidden="true">/</span>
        <Link href={`/companies/${company.company_id}`}>{company.name}</Link><span aria-hidden="true">/</span>
        <span>Catalogue policy</span>
      </div>

      <header className="page-header">
        <div>
          <p className="eyebrow">Catalogue controls</p>
          <h1>Catalogue policy</h1>
          <p className="muted">Set the company catalogue boundary first, then narrow visibility for individual roles.</p>
        </div>
      </header>

      {notice ? <div className="notice">{notice}</div> : null}
      {mutationError ? <div className="error">{mutationError}</div> : null}

      <CompanyPolicySummary policy={policy} />

      <nav className="control-jump-nav" aria-label="Catalogue sections">
        <a href="#company-policy">Company policy</a>
        <a href="#role-policy">Role policy <span className="jump-count">{roles.length}</span></a>
      </nav>

      <section className="stack control-section" id="company-policy">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Company boundary</p>
            <h2>Company catalogue</h2>
            <p className="muted">This is the maximum catalogue any role in {company.name} can see.</p>
          </div>
        </div>

        <div className="policy-status-grid">
          <div className="policy-status-card">
            <strong>Public catalogue</strong>
            <span className="policy-status-value">{policy.allow_public_catalog ? "Allowed" : "Not allowed"}</span>
            <span className="muted small-text">Fluid company-level public catalogue state.</span>
          </div>
          <div className="policy-status-card">
            <strong>Categories</strong>
            <span className="policy-status-value">{policy.category_restriction ? `${policy.allowed_category_ids.length} allowed` : "All allowed"}</span>
            <span className="muted small-text">{policy.category_restriction ? "Explicit category allowlist." : "No company category restriction."}</span>
          </div>
          <div className="policy-status-card">
            <strong>Products</strong>
            <span className="policy-status-value">{policy.product_restriction ? `${policy.allowed_product_ids.length} allowed` : "All allowed"}</span>
            <span className="muted small-text">{policy.product_restriction ? "Explicit product allowlist." : "No company product restriction."}</span>
          </div>
        </div>

        <div className="selection-summary-grid">
          <article className="selection-summary">
            <h3>Allowed categories</h3>
            {policy.category_restriction && policy.allowed_categories.length ? (
              <div className="selection-chip-list">
                {policy.allowed_categories.map((category) => (
                  <span className="selection-chip" key={category.category_id} title={category.path}>
                    {category.name} <code>#{category.category_id}</code>
                  </span>
                ))}
              </div>
            ) : <p className="muted small-text">{policy.category_restriction ? "No categories are currently allowed." : "All company categories are available."}</p>}
          </article>
          <article className="selection-summary">
            <h3>Allowed products</h3>
            {policy.product_restriction && policy.allowed_products.length ? (
              <div className="selection-chip-list">
                {policy.allowed_products.map((product) => (
                  <span className="selection-chip" key={product.product_id}>{product.name} <code>{product.sku}</code></span>
                ))}
              </div>
            ) : <p className="muted small-text">{policy.product_restriction ? "No products are currently allowed." : "All company products are available."}</p>}
          </article>
        </div>

        <details className="card policy-editor" open={Boolean(mutationError && !selectedRole)}>
          <summary className="policy-editor-summary">
            <span><strong>Edit company catalogue</strong><small className="muted">Change public access and company-wide category/product allowlists.</small></span>
          </summary>
          <form action={saveCompanyCatalogPolicyAction} className="policy-editor-body">
            <input name="companyId" type="hidden" value={company.company_id} />
            <div className="form-grid">
              <label className="check-field"><input name="allowPublicCatalog" type="checkbox" defaultChecked={policy.allow_public_catalog} /><span><strong>Allow public catalogue</strong><span className="muted small-text">Expose the public catalogue according to Fluid company policy.</span></span></label>
              <label className="check-field"><input name="categoryRestriction" type="checkbox" defaultChecked={policy.category_restriction} /><span><strong>Restrict categories</strong><span className="muted small-text">When enabled, only the category IDs entered below are allowed.</span></span></label>
              <label className="check-field"><input name="productRestriction" type="checkbox" defaultChecked={policy.product_restriction} /><span><strong>Restrict products</strong><span className="muted small-text">When enabled, only the product SKUs entered below are allowed.</span></span></label>
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="allowedCategoryIds">Allowed category IDs</label>
                <textarea id="allowedCategoryIds" name="allowedCategoryIds" rows={5} defaultValue={policy.allowed_category_ids.join(", ")} placeholder="12, 34, 56" />
                <span className="muted small-text">Fluid validates every ID. Leave empty only when an intentionally empty allowlist is required.</span>
              </div>
              <div className="field">
                <label htmlFor="allowedProductSkus">Allowed product SKUs</label>
                <textarea id="allowedProductSkus" name="allowedProductSkus" rows={5} defaultValue={policy.allowed_products.map((product) => product.sku).join("\n")} placeholder="SKU-001\nSKU-002" />
                <span className="muted small-text">One SKU per line or comma separated. Fluid resolves and validates every SKU.</span>
              </div>
            </div>
            <div><button className="button" type="submit">Save company catalogue</button></div>
          </form>
        </details>
      </section>

      <section className="stack control-section" id="role-policy">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Role visibility</p>
            <h2>Role catalogue</h2>
            <p className="muted">A role can narrow the company catalogue, but Fluid will not let it broaden the company boundary.</p>
          </div>
        </div>

        {!roleContext.management ? (
          <div className="error">{rolePolicyError || "Company roles are unavailable in this admin context."}</div>
        ) : roles.length === 0 ? (
          <div className="empty-state"><strong>No company roles</strong><span className="muted small-text">Create a company role before configuring role catalogue visibility.</span></div>
        ) : (
          <>
            <form className="card role-selector-bar" method="get">
              <div className="field">
                <label htmlFor="roleId">Role</label>
                <select id="roleId" name="roleId" defaultValue={selectedRole?.role_id}>
                  {roles.map((role) => <option key={role.role_id} value={role.role_id}>{role.name}{role.manageable ? "" : " · protected"}</option>)}
                </select>
              </div>
              <button className="button button-secondary" type="submit">Open role</button>
              <span className="role-selector-meta">Role changes remain validated against the company catalogue by Fluid.</span>
            </form>

            {rolePolicyError || !rolePolicy || !selectedRole ? (
              <div className="error">{rolePolicyError || "Role catalogue policy is unavailable."}</div>
            ) : (
              <div className="role-workspace">
                <div className="stat-grid control-summary-grid">
                  <div className="stat-card"><span className="stat-value">{usesAllCompanyCategories ? "All" : rolePolicy.selected_category_ids.length}</span><span className="stat-label">Role categories</span></div>
                  <div className="stat-card"><span className="stat-value">{rolePolicy.products_count}</span><span className="stat-label">Products in category scope</span></div>
                  <div className="stat-card"><span className="stat-value">{rolePolicy.preselect_all_products ? "All" : rolePolicy.allowed_product_ids.length}</span><span className="stat-label">Role products</span></div>
                </div>

                <div className="role-workspace-grid">
                  <section className="card stack role-control-card">
                    <div className="card-heading-row">
                      <div><p className="eyebrow">{selectedRole.name}</p><h3>Categories</h3></div>
                      <span className={`badge ${usesAllCompanyCategories ? "badge-ok" : "badge-neutral"}`}>{usesAllCompanyCategories ? "All company categories" : "Restricted"}</span>
                    </div>
                    <p className="muted">Select a parent category to select its complete branch. Partial branches show an indeterminate state.</p>

                    <form action={saveRoleCategoriesAction} className="mode-choice">
                      <input name="companyId" type="hidden" value={company.company_id} />
                      <input name="roleId" type="hidden" value={selectedRole.role_id} />
                      {allRoleCategoryIds.map((categoryId) => <input key={categoryId} name="categoryIds" type="hidden" value={categoryId} />)}
                      <strong>Use all company categories</strong>
                      <span className="muted small-text">Remove any extra role-level category restriction.</span>
                      <button className="button button-secondary" type="submit">Use all categories</button>
                    </form>

                    <details className="policy-editor" open={!usesAllCompanyCategories}>
                      <summary className="policy-editor-summary"><span><strong>Choose role categories</strong><small className="muted">Search and select the Fluid category tree.</small></span></summary>
                      <form action={saveRoleCategoriesAction} className="policy-editor-body">
                        <input name="companyId" type="hidden" value={company.company_id} />
                        <input name="roleId" type="hidden" value={selectedRole.role_id} />
                        <CatalogCategoryPicker nodes={rolePolicy.category_tree} selectedCategoryIds={rolePolicy.selected_category_ids} label={`${selectedRole.name} categories`} />
                        <div><button className="button" type="submit">Save role categories</button></div>
                      </form>
                    </details>
                  </section>

                  <section className="card stack role-control-card" id="role-products">
                    <div className="card-heading-row">
                      <div><p className="eyebrow">{selectedRole.name}</p><h3>Products</h3></div>
                      <span className={`badge ${rolePolicy.preselect_all_products ? "badge-ok" : "badge-neutral"}`}>{rolePolicy.preselect_all_products ? "All in categories" : "Restricted"}</span>
                    </div>
                    <p className="muted">Product selection can only narrow products already available through the company and role category boundaries.</p>

                    {!rolePolicy.has_saved_categories ? (
                      <form action={saveRoleCategoriesAction} className="mode-choice">
                        <input name="companyId" type="hidden" value={company.company_id} />
                        <input name="roleId" type="hidden" value={selectedRole.role_id} />
                        {allRoleCategoryIds.map((categoryId) => <input key={categoryId} name="categoryIds" type="hidden" value={categoryId} />)}
                        <strong>Category state required</strong>
                        <span className="muted small-text">Fluid requires saved category state before product controls are enabled.</span>
                        <button className="button" type="submit">Use company categories and continue</button>
                      </form>
                    ) : canUseCompanyProductChecklist ? (
                      <form action={saveRoleProductsAction} className="stack">
                        <input name="companyId" type="hidden" value={company.company_id} />
                        <input name="roleId" type="hidden" value={selectedRole.role_id} />
                        <input name="productMode" type="hidden" value="explicit" />
                        <CatalogProductPicker
                          products={policy.allowed_products.map((product) => ({ id: product.product_id, sku: product.sku, name: product.name }))}
                          selectedProductIds={rolePolicy.allowed_product_ids}
                          preselectAll={rolePolicy.preselect_all_products}
                          label={`${selectedRole.name} products`}
                        />
                        <div><button className="button" type="submit">Save role products</button></div>
                      </form>
                    ) : (
                      <div className="mode-choice-grid">
                        <form action={saveRoleProductsAction} className="mode-choice">
                          <input name="companyId" type="hidden" value={company.company_id} />
                          <input name="roleId" type="hidden" value={selectedRole.role_id} />
                          <input name="productMode" type="hidden" value="all" />
                          <strong>All products in selected categories</strong>
                          <span className="muted small-text">No additional role-level product allowlist.</span>
                          <button className="button button-secondary" type="submit">Use all products</button>
                        </form>
                        <form action={saveRoleProductsAction} className="mode-choice">
                          <input name="companyId" type="hidden" value={company.company_id} />
                          <input name="roleId" type="hidden" value={selectedRole.role_id} />
                          <input name="productMode" type="hidden" value="explicit" />
                          <div className="field">
                            <label htmlFor={`allowedProductIds-${selectedRole.role_id}`}>Explicit product IDs</label>
                            <textarea id={`allowedProductIds-${selectedRole.role_id}`} name="allowedProductIds" rows={4} defaultValue={rolePolicy.allowed_product_ids.join(", ")} />
                          </div>
                          <span className="muted small-text">Fluid validates that every product remains inside the role category scope.</span>
                          <button className="button" type="submit">Save explicit products</button>
                        </form>
                      </div>
                    )}
                  </section>
                </div>

                {rolePolicy.show_product_grid ? (
                  <details className="card policy-editor">
                    <summary className="policy-editor-summary"><span><strong>Browse effective products</strong><small className="muted">Search the backend-returned role product grid and verify effective access.</small></span></summary>
                    <div className="policy-editor-body">
                      <form className="inline-form" method="get">
                        <input name="roleId" type="hidden" value={selectedRole.role_id} />
                        <div className="field grow"><label htmlFor="roleProductSearch">Product search</label><input id="roleProductSearch" name="roleProductSearch" defaultValue={roleProductSearch} placeholder="SKU or product name" /></div>
                        <button className="button button-secondary" type="submit">Search products</button>
                      </form>
                      <div className="table-wrap">
                        <table>
                          <thead><tr><th>Product</th><th>SKU</th><th>ID</th><th>Effective access</th></tr></thead>
                          <tbody>
                            {rolePolicy.products.items.map((product) => (
                              <tr key={product.id}><td>{product.name}</td><td><code>{product.sku}</code></td><td>{product.id}</td><td><span className={`badge ${product.allowed ? "badge-ok" : "badge-neutral"}`}>{product.allowed ? "Allowed" : "Not allowed"}</span></td></tr>
                            ))}
                            {!rolePolicy.products.items.length ? <tr><td colSpan={4}>No products match this role/search.</td></tr> : null}
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
                  </details>
                ) : null}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
