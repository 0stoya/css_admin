import Link from "next/link";
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

function categoryFields(nodes: RoleCatalogCategoryNode[], selected: Set<number>, depth = 0): React.ReactNode {
  return nodes.map((node) => (
    <div key={node.id}>
      <label className="catalog-tree-option" style={{ paddingLeft: `${depth * 1.1}rem` }}>
        <input name="categoryIds" type="checkbox" value={node.id} defaultChecked={selected.has(node.id)} />
        <span>{node.label}</span><span className="muted small-text">#{node.id}</span>
      </label>
      {categoryFields(node.children ?? [], selected, depth + 1)}
    </div>
  ));
}

function flattenCategoryIds(nodes: RoleCatalogCategoryNode[]): number[] {
  return Array.from(new Set(nodes.flatMap((node) => [node.id, ...flattenCategoryIds(node.children ?? [])]).filter((id) => id > 0)));
}

function productPageHref(roleId: number, page: number, search?: string) {
  const params = new URLSearchParams({ roleId: String(roleId), rolePage: String(page) });
  if (search) params.set("roleProductSearch", search);
  return `/portal/catalog?${params.toString()}`;
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
  const roleAllowedProductIds = new Set(rolePolicy?.allowed_product_ids ?? []);
  const canUseCompanyProductChecklist = Boolean(rolePolicy?.has_saved_categories && usesAllCompanyCategories && policy.product_restriction);
  const totalProductPages = rolePolicy ? Math.max(1, Math.ceil(rolePolicy.products.total_count / rolePolicy.products.page_size)) : 1;

  return (
    <div className="stack section-gap">
      <div className="breadcrumbs"><Link href="/portal">Company</Link><span>/</span><span>Catalogue controls</span></div>
      <header className="page-header"><div><p className="eyebrow">{companyName}</p><h1>Catalogue controls</h1><p className="muted">Company and role visibility in the currently selected Fluid company context.</p></div></header>
      {firstParam(query.notice) ? <div className="notice">{firstParam(query.notice)}</div> : null}
      {firstParam(query.error) ? <div className="error">{firstParam(query.error)}</div> : null}
      <CompanyPolicySummary policy={policy} />

      <section className="stack">
        <div className="section-heading"><div><h2>Company catalogue</h2><p className="muted">Fluid validates every category and SKU and keeps this policy as the hard upper bound for roles.</p></div></div>
        <form action={savePortalCompanyCatalogPolicyAction} className="card stack">
          <div className="form-grid">
            <label className="check-field"><input name="allowPublicCatalog" type="checkbox" defaultChecked={policy.allow_public_catalog} /><span><strong>Allow public catalogue</strong><span className="muted small-text">Expose the public catalogue according to Fluid company policy.</span></span></label>
            <label className="check-field"><input name="categoryRestriction" type="checkbox" defaultChecked={policy.category_restriction} /><span><strong>Restrict categories</strong><span className="muted small-text">Apply the allowed category IDs below.</span></span></label>
            <label className="check-field"><input name="productRestriction" type="checkbox" defaultChecked={policy.product_restriction} /><span><strong>Restrict products</strong><span className="muted small-text">Apply the allowed product SKUs below.</span></span></label>
          </div>
          <div className="form-grid">
            <div className="field"><label htmlFor="allowedCategoryIds">Allowed category IDs</label><textarea id="allowedCategoryIds" name="allowedCategoryIds" rows={6} defaultValue={policy.allowed_category_ids.join(", ")} /><span className="muted small-text">Comma or whitespace separated.</span></div>
            <div className="field"><label htmlFor="allowedProductSkus">Allowed product SKUs</label><textarea id="allowedProductSkus" name="allowedProductSkus" rows={6} defaultValue={policy.allowed_products.map((product) => product.sku).join("\n")} /><span className="muted small-text">One per line or comma separated.</span></div>
          </div>
          <button className="button" type="submit">Save company catalogue policy</button>
        </form>
      </section>

      <section className="stack">
        <div className="section-heading"><div><h2>Role catalogue</h2><p className="muted">Only control roles returned by Fluid are selectable.</p></div></div>
        {!selectedRole || !rolePolicy ? <div className="card muted">No company roles are available for catalogue controls.</div> : (
          <>
            <form className="card inline-form" method="get"><div className="field grow"><label htmlFor="roleId">Company role</label><select id="roleId" name="roleId" defaultValue={selectedRole.role_id}>{administration.control_roles.map((role) => <option key={role.role_id} value={role.role_id}>{role.name} · #{role.role_id}</option>)}</select></div><button className="button button-secondary" type="submit">Load role policy</button></form>
            <div className="stat-grid">
              <div className="stat-card"><span className="stat-value">{usesAllCompanyCategories ? "All" : rolePolicy.selected_category_ids.length}</span><span className="stat-label">Role categories</span></div>
              <div className="stat-card"><span className="stat-value">{rolePolicy.products_count}</span><span className="stat-label">Products in scope</span></div>
              <div className="stat-card"><span className="stat-value">{rolePolicy.preselect_all_products ? "All" : rolePolicy.allowed_product_ids.length}</span><span className="stat-label">Allowed products</span></div>
            </div>
            <section className="card stack">
              <div className="card-heading-row"><div><p className="eyebrow">{selectedRole.name}</p><h3>Category visibility</h3></div><span className={`badge ${usesAllCompanyCategories ? "badge-ok" : "badge-neutral"}`}>{usesAllCompanyCategories ? "All company categories" : "Restricted categories"}</span></div>
              <form action={savePortalRoleCategoriesAction} className="card stack nested-card"><input name="roleId" type="hidden" value={selectedRole.role_id} />{allCategoryIds.map((id) => <input key={id} name="categoryIds" type="hidden" value={id} />)}<p className="muted">Use the complete company category set for this role.</p><button className="button button-secondary" type="submit">Use all company categories</button></form>
              <details className="mutation-panel"><summary>Restrict categories for this role</summary><form action={savePortalRoleCategoriesAction} className="stack compact-form"><input name="roleId" type="hidden" value={selectedRole.role_id} /><div className="catalog-tree">{categoryFields(rolePolicy.category_tree, selectedCategoryIds)}</div><button className="button" type="submit">Save selected categories</button></form></details>
            </section>
            <section className="card stack">
              <div><h3>Product visibility</h3><p className="muted">Role products cannot broaden the company catalogue.</p></div>
              {!rolePolicy.has_saved_categories ? (
                <form action={savePortalRoleCategoriesAction} className="card stack nested-card"><input name="roleId" type="hidden" value={selectedRole.role_id} />{allCategoryIds.map((id) => <input key={id} name="categoryIds" type="hidden" value={id} />)}<p className="muted">Save category state before configuring products.</p><button className="button" type="submit">Use company categories and enable products</button></form>
              ) : canUseCompanyProductChecklist ? (
                <form action={savePortalRoleProductsAction} className="stack"><input name="roleId" type="hidden" value={selectedRole.role_id} /><input name="productMode" type="hidden" value="explicit" /><div className="resource-picker">{policy.allowed_products.map((product) => <label className="resource-option" key={product.product_id}><input name="allowedProductIds" type="checkbox" value={product.product_id} defaultChecked={rolePolicy.preselect_all_products || roleAllowedProductIds.has(product.product_id)} /><span><strong>{product.name}</strong> <span className="muted small-text"><code>{product.sku}</code> · #{product.product_id}</span></span></label>)}</div><button className="button" type="submit">Save role products</button></form>
              ) : (
                <div className="grid">
                  <form action={savePortalRoleProductsAction} className="card stack nested-card"><input name="roleId" type="hidden" value={selectedRole.role_id} /><input name="productMode" type="hidden" value="all" /><p className="muted">Allow all products in the role&apos;s categories.</p><button className="button button-secondary" type="submit">Use all products</button></form>
                  <form action={savePortalRoleProductsAction} className="card stack nested-card"><input name="roleId" type="hidden" value={selectedRole.role_id} /><input name="productMode" type="hidden" value="explicit" /><div className="field"><label htmlFor={`allowedProductIds-${selectedRole.role_id}`}>Explicit allowed product IDs</label><textarea id={`allowedProductIds-${selectedRole.role_id}`} name="allowedProductIds" rows={5} defaultValue={rolePolicy.allowed_product_ids.join(", ")} /></div><button className="button" type="submit">Save explicit product IDs</button></form>
                </div>
              )}
              {rolePolicy.show_product_grid ? (
                <div className="stack"><form className="inline-form" method="get"><input name="roleId" type="hidden" value={selectedRole.role_id} /><div className="field grow"><label htmlFor="roleProductSearch">Product search</label><input id="roleProductSearch" name="roleProductSearch" defaultValue={roleProductSearch} placeholder="SKU or product name" /></div><button className="button button-secondary" type="submit">Search</button></form><div className="table-wrap"><table><thead><tr><th>Product</th><th>SKU</th><th>ID</th><th>Allowed</th></tr></thead><tbody>{rolePolicy.products.items.map((product) => <tr key={product.id}><td>{product.name}</td><td><code>{product.sku}</code></td><td>{product.id}</td><td><span className={`badge ${product.allowed ? "badge-ok" : "badge-neutral"}`}>{product.allowed ? "Yes" : "No"}</span></td></tr>)}{!rolePolicy.products.items.length ? <tr><td colSpan={4}>No matching products.</td></tr> : null}</tbody></table></div><div className="pagination-row"><span className="muted small-text">Page {rolePolicy.products.page} of {totalProductPages}</span><div className="pagination-actions">{rolePolicy.products.page > 1 ? <Link className="button button-secondary button-link" href={productPageHref(selectedRole.role_id, rolePolicy.products.page - 1, roleProductSearch)}>Previous</Link> : null}{rolePolicy.products.page < totalProductPages ? <Link className="button button-secondary button-link" href={productPageHref(selectedRole.role_id, rolePolicy.products.page + 1, roleProductSearch)}>Next</Link> : null}</div></div></div>
              ) : null}
            </section>
          </>
        )}
      </section>
    </div>
  );
}
