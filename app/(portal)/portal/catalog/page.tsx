import Link from "next/link";
import { CatalogCategoryPicker } from "@/components/catalog-category-picker";
import { CatalogProductPicker } from "@/components/catalog-product-picker";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import {
  getCompanyPortalCatalogPolicy,
  getCompanyPortalRoleCatalogPolicy,
} from "@/lib/graphql/company-portal-catalog";
import {
  getCompanyPortalAdministration,
  getCompanyPortalContext,
} from "@/lib/graphql/company-portal";
import type {
  CompanyCatalogPolicy,
  RoleCatalogCategoryNode,
  RoleCatalogPolicy,
} from "@/lib/graphql/catalog-policy";
import {
  savePortalCompanyCatalogPolicyAction,
  savePortalRoleCategoriesAction,
  savePortalRoleProductsAction,
} from "./actions";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function positivePage(value: string | undefined) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function flattenCategoryIds(nodes: RoleCatalogCategoryNode[]): number[] {
  return Array.from(new Set(nodes.flatMap((node) => [node.id, ...flattenCategoryIds(node.children ?? [])]).filter((id) => id > 0)));
}

function productPageHref(roleId: number, page: number, search?: string) {
  const params = new URLSearchParams({ roleId: String(roleId), rolePage: String(page) });
  if (search) params.set("roleProductSearch", search);
  return `/portal/catalog?${params.toString()}#role-products`;
}

function CompanyPolicySummary({ policy }: { policy: CompanyCatalogPolicy }) {
  return (
    <div className="stat-grid control-summary-grid">
      <div className="stat-card"><span className="stat-value">{policy.allow_public_catalog ? "On" : "Off"}</span><span className="stat-label">Public catalogue</span></div>
      <div className="stat-card"><span className="stat-value">{policy.category_restriction ? policy.allowed_category_ids.length : "All"}</span><span className="stat-label">Company categories</span></div>
      <div className="stat-card"><span className="stat-value">{policy.product_restriction ? policy.allowed_product_ids.length : "All"}</span><span className="stat-label">Company products</span></div>
    </div>
  );
}

export default async function CompanyPortalCatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  let administration;
  try {
    administration = await getCompanyPortalAdministration();
  } catch (error) {
    return <section className="card stack"><div><p className="eyebrow">Company portal</p><h1>Catalogue controls unavailable</h1></div><div className="error">{graphQLErrorMessage(error)}</div></section>;
  }

  if (!administration.can_manage_catalog_visibility) {
    return (
      <section className="card stack">
        <div><p className="eyebrow">Restricted</p><h1>Catalogue controls</h1></div>
        <p className="muted">Fluid has not authorized catalogue visibility management for your role in the selected company.</p>
        <Link className="back-link" href="/portal">← Company overview</Link>
      </section>
    );
  }

  const requestedRoleId = Number(firstParam(query.roleId) ?? 0);
  const selectedRole = administration.control_roles.find((role) => role.role_id === requestedRoleId)
    ?? administration.control_roles[0];
  const rolePage = positivePage(firstParam(query.rolePage));
  const roleProductSearch = firstParam(query.roleProductSearch)?.trim();

  let policy: CompanyCatalogPolicy;
  let rolePolicy: RoleCatalogPolicy | null = null;
  let companyName = `Company ${administration.company_id}`;
  try {
    const [catalogPolicy, context] = await Promise.all([
      getCompanyPortalCatalogPolicy(),
      getCompanyPortalContext(),
    ]);
    policy = catalogPolicy;
    const selectedCompany = context.companies.find((company) => company.selected);
    if (selectedCompany?.name) companyName = selectedCompany.name;
    if (selectedRole) {
      rolePolicy = await getCompanyPortalRoleCatalogPolicy(selectedRole.role_id, rolePage, roleProductSearch);
    }
  } catch (error) {
    return <section className="card stack"><div><p className="eyebrow">Backend request failed</p><h1>Catalogue controls unavailable</h1></div><div className="error">{graphQLErrorMessage(error)}</div></section>;
  }

  const allCategoryIds = rolePolicy ? flattenCategoryIds(rolePolicy.category_tree) : [];
  const selectedCategoryIds = new Set(rolePolicy?.selected_category_ids ?? []);
  const usesAllCompanyCategories = allCategoryIds.length > 0 && allCategoryIds.every((id) => selectedCategoryIds.has(id));
  const canUseCompanyProductChecklist = Boolean(rolePolicy?.has_saved_categories && usesAllCompanyCategories && policy.product_restriction);
  const totalProductPages = rolePolicy ? Math.max(1, Math.ceil(rolePolicy.products.total_count / rolePolicy.products.page_size)) : 1;
  const notice = firstParam(query.notice);
  const mutationError = firstParam(query.error);

  return (
    <div className="stack control-page">
      <div className="breadcrumbs"><Link href="/portal">Company</Link><span>/</span><span>Catalogue controls</span></div>
      <header className="page-header">
        <div><p className="eyebrow">{companyName}</p><h1>Catalogue controls</h1><p className="muted">Set the company catalogue boundary first, then narrow visibility for individual company roles.</p></div>
      </header>
      {notice ? <div className="notice">{notice}</div> : null}
      {mutationError ? <div className="error">{mutationError}</div> : null}

      <CompanyPolicySummary policy={policy} />

      <nav className="control-jump-nav" aria-label="Catalogue sections">
        <a href="#company-policy">Company policy</a>
        <a href="#role-policy">Role policy <span className="jump-count">{administration.control_roles.length}</span></a>
      </nav>

      <section className="stack control-section" id="company-policy">
        <div className="section-heading"><div><p className="eyebrow">Company boundary</p><h2>Company catalogue</h2><p className="muted">This is the maximum catalogue available to roles in {companyName}.</p></div></div>

        <div className="policy-status-grid">
          <div className="policy-status-card"><strong>Public catalogue</strong><span className="policy-status-value">{policy.allow_public_catalog ? "Allowed" : "Not allowed"}</span><span className="muted small-text">Fluid company-level public catalogue state.</span></div>
          <div className="policy-status-card"><strong>Categories</strong><span className="policy-status-value">{policy.category_restriction ? `${policy.allowed_category_ids.length} allowed` : "All allowed"}</span><span className="muted small-text">{policy.category_restriction ? "Explicit category allowlist." : "No company category restriction."}</span></div>
          <div className="policy-status-card"><strong>Products</strong><span className="policy-status-value">{policy.product_restriction ? `${policy.allowed_product_ids.length} allowed` : "All allowed"}</span><span className="muted small-text">{policy.product_restriction ? "Explicit product allowlist." : "No company product restriction."}</span></div>
        </div>

        <div className="selection-summary-grid">
          <article className="selection-summary">
            <h3>Allowed categories</h3>
            {policy.category_restriction && policy.allowed_categories.length ? <div className="selection-chip-list">{policy.allowed_categories.map((category) => <span className="selection-chip" key={category.category_id} title={category.path}>{category.name} <code>#{category.category_id}</code></span>)}</div> : <p className="muted small-text">{policy.category_restriction ? "No categories are currently allowed." : "All company categories are available."}</p>}
          </article>
          <article className="selection-summary">
            <h3>Allowed products</h3>
            {policy.product_restriction && policy.allowed_products.length ? <div className="selection-chip-list">{policy.allowed_products.map((product) => <span className="selection-chip" key={product.product_id}>{product.name} <code>{product.sku}</code></span>)}</div> : <p className="muted small-text">{policy.product_restriction ? "No products are currently allowed." : "All company products are available."}</p>}
          </article>
        </div>

        <details className="card policy-editor">
          <summary className="policy-editor-summary"><span><strong>Edit company catalogue</strong><small className="muted">Change public access and company-wide category/product allowlists.</small></span></summary>
          <form action={savePortalCompanyCatalogPolicyAction} className="policy-editor-body">
            <div className="form-grid">
              <label className="check-field"><input name="allowPublicCatalog" type="checkbox" defaultChecked={policy.allow_public_catalog} /><span><strong>Allow public catalogue</strong><span className="muted small-text">Expose the public catalogue according to Fluid company policy.</span></span></label>
              <label className="check-field"><input name="categoryRestriction" type="checkbox" defaultChecked={policy.category_restriction} /><span><strong>Restrict categories</strong><span className="muted small-text">When enabled, only the category IDs entered below are allowed.</span></span></label>
              <label className="check-field"><input name="productRestriction" type="checkbox" defaultChecked={policy.product_restriction} /><span><strong>Restrict products</strong><span className="muted small-text">When enabled, only the product SKUs entered below are allowed.</span></span></label>
            </div>
            <div className="form-grid">
              <div className="field"><label htmlFor="allowedCategoryIds">Allowed category IDs</label><textarea id="allowedCategoryIds" name="allowedCategoryIds" rows={5} defaultValue={policy.allowed_category_ids.join(", ")} placeholder="12, 34, 56" /><span className="muted small-text">Fluid validates every category ID.</span></div>
              <div className="field"><label htmlFor="allowedProductSkus">Allowed product SKUs</label><textarea id="allowedProductSkus" name="allowedProductSkus" rows={5} defaultValue={policy.allowed_products.map((product) => product.sku).join("\n")} placeholder="SKU-001\nSKU-002" /><span className="muted small-text">One SKU per line or comma separated; Fluid resolves each SKU.</span></div>
            </div>
            <div><button className="button" type="submit">Save company catalogue</button></div>
          </form>
        </details>
      </section>

      <section className="stack control-section" id="role-policy">
        <div className="section-heading"><div><p className="eyebrow">Role visibility</p><h2>Role catalogue</h2><p className="muted">Only control roles returned by Fluid are available here.</p></div></div>

        {!selectedRole || !rolePolicy ? (
          <div className="empty-state"><strong>No company roles available</strong><span className="muted small-text">A role must be available in the selected company before role catalogue controls can be configured.</span></div>
        ) : (
          <>
            <form className="card role-selector-bar" method="get">
              <div className="field"><label htmlFor="roleId">Role</label><select id="roleId" name="roleId" defaultValue={selectedRole.role_id}>{administration.control_roles.map((role) => <option key={role.role_id} value={role.role_id}>{role.name}</option>)}</select></div>
              <button className="button button-secondary" type="submit">Open role</button>
              <span className="role-selector-meta">Fluid remains authoritative for every catalogue write.</span>
            </form>

            <div className="stat-grid control-summary-grid">
              <div className="stat-card"><span className="stat-value">{usesAllCompanyCategories ? "All" : rolePolicy.selected_category_ids.length}</span><span className="stat-label">Role categories</span></div>
              <div className="stat-card"><span className="stat-value">{rolePolicy.products_count}</span><span className="stat-label">Products in category scope</span></div>
              <div className="stat-card"><span className="stat-value">{rolePolicy.preselect_all_products ? "All" : rolePolicy.allowed_product_ids.length}</span><span className="stat-label">Role products</span></div>
            </div>

            <div className="role-workspace-grid">
              <section className="card stack role-control-card">
                <div className="card-heading-row"><div><p className="eyebrow">{selectedRole.name}</p><h3>Categories</h3></div><span className={`badge ${usesAllCompanyCategories ? "badge-ok" : "badge-neutral"}`}>{usesAllCompanyCategories ? "All company categories" : "Restricted"}</span></div>
                <p className="muted">Selecting a parent category selects its complete branch; partial branches show an indeterminate state.</p>
                <form action={savePortalRoleCategoriesAction} className="mode-choice">
                  <input name="roleId" type="hidden" value={selectedRole.role_id} />
                  {allCategoryIds.map((id) => <input key={id} name="categoryIds" type="hidden" value={id} />)}
                  <strong>Use all company categories</strong><span className="muted small-text">Remove any extra role-level category restriction.</span><button className="button button-secondary" type="submit">Use all categories</button>
                </form>
                <details className="policy-editor" open={!usesAllCompanyCategories}>
                  <summary className="policy-editor-summary"><span><strong>Choose role categories</strong><small className="muted">Search and select the Fluid category tree.</small></span></summary>
                  <form action={savePortalRoleCategoriesAction} className="policy-editor-body">
                    <input name="roleId" type="hidden" value={selectedRole.role_id} />
                    <CatalogCategoryPicker nodes={rolePolicy.category_tree} selectedCategoryIds={rolePolicy.selected_category_ids} label={`${selectedRole.name} categories`} />
                    <div><button className="button" type="submit">Save role categories</button></div>
                  </form>
                </details>
              </section>

              <section className="card stack role-control-card" id="role-products">
                <div className="card-heading-row"><div><p className="eyebrow">{selectedRole.name}</p><h3>Products</h3></div><span className={`badge ${rolePolicy.preselect_all_products ? "badge-ok" : "badge-neutral"}`}>{rolePolicy.preselect_all_products ? "All in categories" : "Restricted"}</span></div>
                <p className="muted">Role products cannot broaden the company catalogue or selected role categories.</p>
                {!rolePolicy.has_saved_categories ? (
                  <form action={savePortalRoleCategoriesAction} className="mode-choice"><input name="roleId" type="hidden" value={selectedRole.role_id} />{allCategoryIds.map((id) => <input key={id} name="categoryIds" type="hidden" value={id} />)}<strong>Category state required</strong><span className="muted small-text">Save category state before configuring products.</span><button className="button" type="submit">Use company categories and continue</button></form>
                ) : canUseCompanyProductChecklist ? (
                  <form action={savePortalRoleProductsAction} className="stack"><input name="roleId" type="hidden" value={selectedRole.role_id} /><input name="productMode" type="hidden" value="explicit" /><CatalogProductPicker products={policy.allowed_products.map((product) => ({ id: product.product_id, sku: product.sku, name: product.name }))} selectedProductIds={rolePolicy.allowed_product_ids} preselectAll={rolePolicy.preselect_all_products} label={`${selectedRole.name} products`} /><div><button className="button" type="submit">Save role products</button></div></form>
                ) : (
                  <div className="mode-choice-grid">
                    <form action={savePortalRoleProductsAction} className="mode-choice"><input name="roleId" type="hidden" value={selectedRole.role_id} /><input name="productMode" type="hidden" value="all" /><strong>All products in selected categories</strong><span className="muted small-text">No additional role-level product allowlist.</span><button className="button button-secondary" type="submit">Use all products</button></form>
                    <form action={savePortalRoleProductsAction} className="mode-choice"><input name="roleId" type="hidden" value={selectedRole.role_id} /><input name="productMode" type="hidden" value="explicit" /><div className="field"><label htmlFor={`allowedProductIds-${selectedRole.role_id}`}>Explicit product IDs</label><textarea id={`allowedProductIds-${selectedRole.role_id}`} name="allowedProductIds" rows={4} defaultValue={rolePolicy.allowed_product_ids.join(", ")} /></div><span className="muted small-text">Fluid validates every product against the role category scope.</span><button className="button" type="submit">Save explicit products</button></form>
                  </div>
                )}
              </section>
            </div>

            {rolePolicy.show_product_grid ? (
              <details className="card policy-editor">
                <summary className="policy-editor-summary"><span><strong>Browse effective products</strong><small className="muted">Search the backend-returned product grid and verify effective role access.</small></span></summary>
                <div className="policy-editor-body">
                  <form className="inline-form" method="get"><input name="roleId" type="hidden" value={selectedRole.role_id} /><div className="field grow"><label htmlFor="roleProductSearch">Product search</label><input id="roleProductSearch" name="roleProductSearch" defaultValue={roleProductSearch} placeholder="SKU or product name" /></div><button className="button button-secondary" type="submit">Search</button></form>
                  <div className="table-wrap"><table><thead><tr><th>Product</th><th>SKU</th><th>ID</th><th>Effective access</th></tr></thead><tbody>{rolePolicy.products.items.map((product) => <tr key={product.id}><td>{product.name}</td><td><code>{product.sku}</code></td><td>{product.id}</td><td><span className={`badge ${product.allowed ? "badge-ok" : "badge-neutral"}`}>{product.allowed ? "Allowed" : "Not allowed"}</span></td></tr>)}{!rolePolicy.products.items.length ? <tr><td colSpan={4}>No matching products.</td></tr> : null}</tbody></table></div>
                  <div className="pagination-row"><span className="muted small-text">Page {rolePolicy.products.page} of {totalProductPages} · {rolePolicy.products.total_count} products</span><div className="pagination-actions">{rolePolicy.products.page > 1 ? <Link className="button button-secondary button-link" href={productPageHref(selectedRole.role_id, rolePolicy.products.page - 1, roleProductSearch)}>Previous</Link> : null}{rolePolicy.products.page < totalProductPages ? <Link className="button button-secondary button-link" href={productPageHref(selectedRole.role_id, rolePolicy.products.page + 1, roleProductSearch)}>Next</Link> : null}</div></div>
                </div>
              </details>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
