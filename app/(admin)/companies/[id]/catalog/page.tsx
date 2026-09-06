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

type CatalogueView = "company" | "roles";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function catalogueView(value: string | undefined): CatalogueView {
  return value === "roles" ? "roles" : "company";
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

function CatalogueTabs({
  companyId,
  view,
  roleCount,
}: {
  companyId: number;
  view: CatalogueView;
  roleCount: number;
}) {
  const base = `/companies/${companyId}/catalog`;
  return (
    <nav className="catalogue-tabs" aria-label="Catalogue policy workspace">
      <Link
        className={view === "company" ? "catalogue-tab catalogue-tab-active" : "catalogue-tab"}
        href={base}
        aria-current={view === "company" ? "page" : undefined}
      >
        <span>Company catalogue</span>
      </Link>
      <Link
        className={view === "roles" ? "catalogue-tab catalogue-tab-active" : "catalogue-tab"}
        href={`${base}?view=roles`}
        aria-current={view === "roles" ? "page" : undefined}
      >
        <span>Role catalogue</span><strong>{roleCount}</strong>
      </Link>
    </nav>
  );
}

function CompanyPolicyStatus({ policy }: { policy: CompanyCatalogPolicy }) {
  return (
    <div className="catalogue-status-grid">
      <article className="catalogue-status-card">
        <span className="catalogue-status-label">Public catalogue</span>
        <strong>{policy.allow_public_catalog ? "Allowed" : "Not allowed"}</strong>
        <span className={`badge ${policy.allow_public_catalog ? "badge-ok" : "badge-neutral"}`}>
          {policy.allow_public_catalog ? "On" : "Off"}
        </span>
      </article>
      <article className="catalogue-status-card">
        <span className="catalogue-status-label">Categories</span>
        <strong>{policy.category_restriction ? `${policy.allowed_category_ids.length} allowed` : "All categories"}</strong>
        <span className={`badge ${policy.category_restriction ? "badge-neutral" : "badge-ok"}`}>
          {policy.category_restriction ? "Restricted" : "Unrestricted"}
        </span>
      </article>
      <article className="catalogue-status-card">
        <span className="catalogue-status-label">Products</span>
        <strong>{policy.product_restriction ? `${policy.allowed_product_ids.length} allowed` : "All products"}</strong>
        <span className={`badge ${policy.product_restriction ? "badge-neutral" : "badge-ok"}`}>
          {policy.product_restriction ? "Restricted" : "Unrestricted"}
        </span>
      </article>
    </div>
  );
}

function productPageHref(companyId: number, roleId: number, page: number, search?: string) {
  const params = new URLSearchParams({
    view: "roles",
    roleId: String(roleId),
    rolePage: String(page),
  });
  if (search) params.set("roleProductSearch", search);
  return `/companies/${companyId}/catalog?${params.toString()}#effective-products`;
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

  const view = catalogueView(firstParam(query.view));
  const notice = firstParam(query.notice);
  const mutationError = firstParam(query.error);
  const roleSearch = firstParam(query.roleSearch)?.trim() ?? "";
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
        <section className="card stack">
          <div><p className="eyebrow">Backend request failed</p><h1>Catalogue policy unavailable</h1></div>
          <div className="error">{error}</div>
          <div><Link className="button button-secondary button-link" href={`/companies/${companyId}`}>Return to company overview</Link></div>
        </section>
      </div>
    );
  }

  const roles = roleContext.management?.roles ?? [];
  const normalizedRoleSearch = roleSearch.toLocaleLowerCase();
  const filteredRoles = roles.filter((role) => !normalizedRoleSearch || role.name.toLocaleLowerCase().includes(normalizedRoleSearch));

  const requestedRole = Number.isInteger(requestedRoleId) && requestedRoleId > 0
    ? roles.find((role) => role.role_id === requestedRoleId)
    : undefined;
  const selectedRole = view === "roles" ? (requestedRole ?? filteredRoles[0] ?? roles[0]) : undefined;

  let rolePolicy: RoleCatalogPolicy | null = null;
  let rolePolicyError = roleContext.error;
  if (selectedRole && !rolePolicyError) {
    const result = await loadRolePolicy(companyId, selectedRole.role_id, rolePage, roleProductSearch);
    rolePolicy = result.policy;
    rolePolicyError = result.error;
  }

  const allRoleCategoryIds = rolePolicy ? flattenCategoryIds(rolePolicy.category_tree) : [];
  const selectedCategoryIds = new Set(rolePolicy?.selected_category_ids ?? []);
  const usesAllCompanyCategories = Boolean(
    rolePolicy
    && (allRoleCategoryIds.length === 0 || allRoleCategoryIds.every((categoryId) => selectedCategoryIds.has(categoryId))),
  );
  const canUseCompanyProductChecklist = Boolean(
    rolePolicy
    && usesAllCompanyCategories
    && policy.product_restriction,
  );
  const totalProductPages = rolePolicy
    ? Math.max(1, Math.ceil(rolePolicy.products.total_count / rolePolicy.products.page_size))
    : 1;

  return (
    <div className="stack section-gap catalogue-workspace">
      <header className="page-header">
        <div>
          <p className="eyebrow">Catalogue access</p>
          <h1>Catalogue policy</h1>
          <p className="muted">Control the company catalogue boundary and any additional role-level restrictions.</p>
        </div>
      </header>

      {notice ? <div className="notice">{notice}</div> : null}
      {mutationError ? <div className="error">{mutationError}</div> : null}

      <CatalogueTabs companyId={company.company_id} view={view} roleCount={roles.length} />

      {view === "company" ? (
        <section className="stack catalogue-view">
          <div className="catalogue-view-heading">
            <div>
              <p className="eyebrow">Company boundary</p>
              <h2>Company catalogue</h2>
              <p className="muted">The maximum catalogue available to every role in this company.</p>
            </div>
          </div>

          <CompanyPolicyStatus policy={policy} />

          {(policy.category_restriction || policy.product_restriction) ? (
            <div className="catalogue-selection-grid">
              {policy.category_restriction ? (
                <article className="catalogue-selection-card">
                  <div className="catalogue-selection-heading">
                    <div><span className="catalogue-status-label">Allowed categories</span><strong>{policy.allowed_category_ids.length}</strong></div>
                  </div>
                  {policy.allowed_categories.length ? (
                    <div className="selection-chip-list">
                      {policy.allowed_categories.map((category) => (
                        <span className="selection-chip" key={category.category_id} title={category.path}>
                          {category.name} <code>#{category.category_id}</code>
                        </span>
                      ))}
                    </div>
                  ) : <p className="muted small-text">The category allowlist is currently empty.</p>}
                </article>
              ) : null}

              {policy.product_restriction ? (
                <article className="catalogue-selection-card">
                  <div className="catalogue-selection-heading">
                    <div><span className="catalogue-status-label">Allowed products</span><strong>{policy.allowed_product_ids.length}</strong></div>
                  </div>
                  {policy.allowed_products.length ? (
                    <div className="selection-chip-list">
                      {policy.allowed_products.map((product) => (
                        <span className="selection-chip" key={product.product_id}>{product.name} <code>{product.sku}</code></span>
                      ))}
                    </div>
                  ) : <p className="muted small-text">The product allowlist is currently empty.</p>}
                </article>
              ) : null}
            </div>
          ) : (
            <div className="catalogue-unrestricted card">
              <div><strong>No company catalogue restriction</strong><span>Roles can use the full company catalogue unless they add their own category or product restriction.</span></div>
            </div>
          )}

          <details className="card catalogue-editor" open={Boolean(mutationError)}>
            <summary className="catalogue-editor-summary">
              <span><strong>Edit company catalogue</strong><small>Public access, categories and products</small></span>
              <span className="catalogue-summary-chevron" aria-hidden="true" />
            </summary>
            <form action={saveCompanyCatalogPolicyAction} className="catalogue-editor-body">
              <input name="companyId" type="hidden" value={company.company_id} />

              <div className="catalogue-toggle-grid">
                <label className="check-field"><input name="allowPublicCatalog" type="checkbox" defaultChecked={policy.allow_public_catalog} /><span><strong>Allow public catalogue</strong><span className="muted small-text">Use the Fluid company-level public catalogue setting.</span></span></label>
                <label className="check-field"><input name="categoryRestriction" type="checkbox" defaultChecked={policy.category_restriction} /><span><strong>Restrict categories</strong><span className="muted small-text">Only the category IDs below remain available.</span></span></label>
                <label className="check-field"><input name="productRestriction" type="checkbox" defaultChecked={policy.product_restriction} /><span><strong>Restrict products</strong><span className="muted small-text">Only the SKUs below remain available.</span></span></label>
              </div>

              <div className="catalogue-company-editor-grid">
                <div className="field">
                  <label htmlFor="allowedCategoryIds">Allowed category IDs</label>
                  <textarea id="allowedCategoryIds" name="allowedCategoryIds" rows={6} defaultValue={policy.allowed_category_ids.join(", ")} placeholder="12, 34, 56" />
                  <span className="muted small-text">Fluid validates every category ID.</span>
                </div>
                <div className="field">
                  <label htmlFor="allowedProductSkus">Allowed product SKUs</label>
                  <textarea id="allowedProductSkus" name="allowedProductSkus" rows={6} defaultValue={policy.allowed_products.map((product) => product.sku).join("\n")} placeholder="SKU-001\nSKU-002" />
                  <span className="muted small-text">One SKU per line or comma separated.</span>
                </div>
              </div>

              <div className="catalogue-form-actions"><button className="button" type="submit">Save company catalogue</button></div>
            </form>
          </details>
        </section>
      ) : (
        <section className="stack catalogue-view">
          <div className="catalogue-view-heading">
            <div>
              <p className="eyebrow">Role visibility</p>
              <h2>Role catalogue</h2>
              <p className="muted">Category and product restrictions are independent. A role can narrow, but never broaden, the company boundary.</p>
            </div>
          </div>

          {!roleContext.management ? (
            <div className="error">{rolePolicyError || "Company roles are unavailable in this admin context."}</div>
          ) : roles.length === 0 ? (
            <div className="empty-state"><strong>No company roles</strong><span className="muted small-text">Create a company role before configuring catalogue visibility.</span></div>
          ) : (
            <>
              <form className="card catalogue-role-search" method="get">
                <input name="view" type="hidden" value="roles" />
                <div className="field grow">
                  <label htmlFor="roleSearch">Find a role</label>
                  <input id="roleSearch" name="roleSearch" type="search" defaultValue={roleSearch} placeholder="Role name" />
                </div>
                <button className="button button-secondary" type="submit">Search</button>
                {roleSearch ? <Link className="button button-secondary button-link" href={`/companies/${company.company_id}/catalog?view=roles`}>Clear</Link> : null}
              </form>

              <div className="catalogue-role-list">
                <div className="catalogue-role-header" aria-hidden="true">
                  <span>Role</span><span>Users</span><span>Status</span><span />
                </div>
                {filteredRoles.map((role) => {
                  const active = selectedRole?.role_id === role.role_id;
                  return (
                    <Link
                      className={`catalogue-role-row${active ? " catalogue-role-row-active" : ""}`}
                      href={`/companies/${company.company_id}/catalog?view=roles&roleId=${role.role_id}#role-editor`}
                      key={role.role_id}
                      aria-current={active ? "page" : undefined}
                    >
                      <span className="catalogue-role-name"><strong>{role.name}</strong><small>Role #{role.role_id}</small></span>
                      <span data-label="Users">{role.user_count}</span>
                      <span data-label="Status"><span className={`badge ${role.manageable ? "badge-ok" : "badge-neutral"}`}>{role.manageable ? "Manageable" : "Protected"}</span></span>
                      <span className="catalogue-role-action">{active ? "Open" : "Manage"}<span className="catalogue-row-chevron" aria-hidden="true" /></span>
                    </Link>
                  );
                })}
                {!filteredRoles.length ? <div className="management-empty-state"><strong>No roles match this search.</strong><span>Clear the search and try again.</span></div> : null}
              </div>

              {rolePolicyError || !rolePolicy || !selectedRole ? (
                filteredRoles.length ? <div className="error">{rolePolicyError || "Role catalogue policy is unavailable."}</div> : null
              ) : (
                <div className="catalogue-role-editor" id="role-editor">
                  <div className="catalogue-role-editor-heading">
                    <div>
                      <p className="eyebrow">Role catalogue</p>
                      <h2>{selectedRole.name}</h2>
                      <p className="muted">Change categories and products independently. Fluid validates both against the company catalogue.</p>
                    </div>
                    {!selectedRole.manageable ? <span className="badge badge-neutral">Protected role</span> : null}
                  </div>

                  <div className="catalogue-role-status">
                    <div><span>Categories</span><strong>{usesAllCompanyCategories ? "All company categories" : `${rolePolicy.selected_category_ids.length} selected`}</strong></div>
                    <div><span>Products in scope</span><strong>{rolePolicy.products_count}</strong></div>
                    <div><span>Product restriction</span><strong>{rolePolicy.preselect_all_products ? "All products" : `${rolePolicy.allowed_product_ids.length} selected`}</strong></div>
                  </div>

                  {selectedRole.manageable ? (
                    <div className="catalogue-role-controls">
                      <section className="card catalogue-role-control">
                        <div className="catalogue-control-heading">
                          <div><p className="eyebrow">Categories</p><h3>Role categories</h3><p className="muted">Optional additional category restriction.</p></div>
                          <span className={`badge ${usesAllCompanyCategories ? "badge-ok" : "badge-neutral"}`}>{usesAllCompanyCategories ? "No restriction" : "Restricted"}</span>
                        </div>

                        {!usesAllCompanyCategories ? (
                          <form action={saveRoleCategoriesAction} className="catalogue-reset-action">
                            <input name="companyId" type="hidden" value={company.company_id} />
                            <input name="roleId" type="hidden" value={selectedRole.role_id} />
                            {allRoleCategoryIds.map((categoryId) => <input key={categoryId} name="categoryIds" type="hidden" value={categoryId} />)}
                            <span><strong>Use all company categories</strong><small>Remove the role-level category restriction.</small></span>
                            <button className="button button-secondary" type="submit">Remove restriction</button>
                          </form>
                        ) : null}

                        <details className="catalogue-control-editor" open={!usesAllCompanyCategories}>
                          <summary><span><strong>{usesAllCompanyCategories ? "Restrict categories" : "Edit categories"}</strong><small>Search and select the Fluid category tree</small></span><span className="catalogue-summary-chevron" aria-hidden="true" /></summary>
                          <form action={saveRoleCategoriesAction} className="catalogue-control-editor-body">
                            <input name="companyId" type="hidden" value={company.company_id} />
                            <input name="roleId" type="hidden" value={selectedRole.role_id} />
                            <CatalogCategoryPicker nodes={rolePolicy.category_tree} selectedCategoryIds={rolePolicy.selected_category_ids} label={`${selectedRole.name} categories`} />
                            <div className="catalogue-form-actions"><button className="button" type="submit">Save role categories</button></div>
                          </form>
                        </details>
                      </section>

                      <section className="card catalogue-role-control" id="role-products">
                        <div className="catalogue-control-heading">
                          <div><p className="eyebrow">Products</p><h3>Role products</h3><p className="muted">Optional product restriction, independent from categories.</p></div>
                          <span className={`badge ${rolePolicy.preselect_all_products ? "badge-ok" : "badge-neutral"}`}>{rolePolicy.preselect_all_products ? "No restriction" : "Restricted"}</span>
                        </div>

                        {!rolePolicy.preselect_all_products ? (
                          <form action={saveRoleProductsAction} className="catalogue-reset-action">
                            <input name="companyId" type="hidden" value={company.company_id} />
                            <input name="roleId" type="hidden" value={selectedRole.role_id} />
                            <input name="productMode" type="hidden" value="all" />
                            <span><strong>Use all available products</strong><small>Remove the role-level product restriction.</small></span>
                            <button className="button button-secondary" type="submit">Remove restriction</button>
                          </form>
                        ) : null}

                        <details className="catalogue-control-editor" open={!rolePolicy.preselect_all_products}>
                          <summary><span><strong>{rolePolicy.preselect_all_products ? "Restrict products" : "Edit products"}</strong><small>Products are validated independently against the company boundary</small></span><span className="catalogue-summary-chevron" aria-hidden="true" /></summary>
                          <div className="catalogue-control-editor-body">
                            {canUseCompanyProductChecklist ? (
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
                                <div className="catalogue-form-actions"><button className="button" type="submit">Save role products</button></div>
                              </form>
                            ) : (
                              <form action={saveRoleProductsAction} className="stack catalogue-explicit-products">
                                <input name="companyId" type="hidden" value={company.company_id} />
                                <input name="roleId" type="hidden" value={selectedRole.role_id} />
                                <input name="productMode" type="hidden" value="explicit" />
                                <div className="field">
                                  <label htmlFor={`allowedProductIds-${selectedRole.role_id}`}>Allowed product IDs</label>
                                  <textarea id={`allowedProductIds-${selectedRole.role_id}`} name="allowedProductIds" rows={6} defaultValue={rolePolicy.allowed_product_ids.join(", ")} placeholder="123, 456, 789" />
                                  <span className="muted small-text">The current Fluid contract exposes the complete selection as product IDs for this category scope. Every ID is validated on save.</span>
                                </div>
                                <div className="catalogue-form-actions"><button className="button" type="submit">Save role products</button></div>
                              </form>
                            )}
                          </div>
                        </details>
                      </section>
                    </div>
                  ) : (
                    <div className="card catalogue-protected-note">
                      <strong>Protected role</strong>
                      <span>Fluid exposes this catalogue state for reference but does not allow the role to be edited here.</span>
                    </div>
                  )}

                  {rolePolicy.show_product_grid ? (
                    <details className="card catalogue-effective-products" id="effective-products">
                      <summary className="catalogue-editor-summary"><span><strong>Browse effective products</strong><small>Verify what this role can actually see</small></span><span className="catalogue-summary-chevron" aria-hidden="true" /></summary>
                      <div className="catalogue-editor-body">
                        <form className="inline-form" method="get">
                          <input name="view" type="hidden" value="roles" />
                          <input name="roleId" type="hidden" value={selectedRole.role_id} />
                          <div className="field grow"><label htmlFor="roleProductSearch">Product search</label><input id="roleProductSearch" name="roleProductSearch" defaultValue={roleProductSearch} placeholder="SKU or product name" /></div>
                          <button className="button button-secondary" type="submit">Search</button>
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
      )}
    </div>
  );
}
