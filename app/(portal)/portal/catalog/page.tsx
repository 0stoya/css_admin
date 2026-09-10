import Link from "next/link";
import { CatalogCategoryPicker } from "@/components/catalog-category-picker";
import { CatalogProductPicker } from "@/components/catalog-product-picker";
import { PortalModal } from "@/components/portal/portal-modal";
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
import styles from "@/components/portal/portal-catalogue.module.css";

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
  return `/portal/catalog?${params.toString()}#effective-products`;
}

function CompanyPolicySummary({ policy }: { policy: CompanyCatalogPolicy }) {
  return (
    <section className={styles.summaryGrid} aria-label="Company catalogue summary">
      <article className={styles.metricCard}>
        <span>Public catalogue</span>
        <strong>{policy.allow_public_catalog ? "Allowed" : "Not allowed"}</strong>
        <small>Company-wide public catalogue access</small>
      </article>
      <article className={styles.metricCard}>
        <span>Categories</span>
        <strong>{policy.category_restriction ? policy.allowed_category_ids.length : "All"}</strong>
        <small>{policy.category_restriction ? "Explicitly allowed" : "No category restriction"}</small>
      </article>
      <article className={`${styles.metricCard} ${styles.metricPrimary}`}>
        <span>Products</span>
        <strong>{policy.product_restriction ? policy.allowed_product_ids.length : "All"}</strong>
        <small>{policy.product_restriction ? "Explicitly allowed" : "No product restriction"}</small>
      </article>
    </section>
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
      <section className={`card stack ${styles.restrictedCard}`}>
        <div><p className="eyebrow">Restricted</p><h1>Catalogue controls</h1></div>
        <p className="muted">Your company role does not allow catalogue visibility management for the selected company.</p>
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
  let companyReference = "Selected company";
  try {
    const [catalogPolicy, context] = await Promise.all([
      getCompanyPortalCatalogPolicy(),
      getCompanyPortalContext(),
    ]);
    policy = catalogPolicy;
    const selectedCompany = context.companies.find((company) => company.selected);
    if (selectedCompany?.name) companyName = selectedCompany.name;
    if (selectedCompany?.reference) companyReference = selectedCompany.reference;
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
    <div className={styles.workspace}>
      <header className={styles.pageHeader}>
        <div>
          <p className="eyebrow">{companyReference}</p>
          <h1>Catalogue</h1>
          <p>Control the products and categories available to your company, then narrow access for individual company roles.</p>
        </div>
        <div className={styles.headerBadge}>
          <span>Catalogue access</span>
          <strong>Manage visibility</strong>
        </div>
      </header>

      {notice ? <div className="notice">{notice}</div> : null}
      {mutationError ? <div className="error">{mutationError}</div> : null}

      <CompanyPolicySummary policy={policy} />

      <nav className={styles.jumpNav} aria-label="Catalogue sections">
        <a href="#company-policy"><span>Company catalogue</span><small>Your maximum catalogue boundary</small></a>
        <a href="#role-policy"><span>Role visibility</span><small>{administration.control_roles.length} role{administration.control_roles.length === 1 ? "" : "s"} available</small></a>
      </nav>

      <section className={styles.section} id="company-policy">
        <div className={styles.sectionHeading}>
          <div>
            <p className="eyebrow">Company catalogue</p>
            <h2>Your catalogue boundary</h2>
            <p className="muted">This is the widest catalogue any role in {companyName} can receive.</p>
          </div>
          <PortalModal
            title="Edit company catalogue"
            description="Change the company-wide public catalogue, category and product restrictions. Fluid validates every saved value."
            triggerLabel="Edit catalogue"
            triggerHint="Company-wide visibility"
            triggerIcon="edit"
          >
            <form action={savePortalCompanyCatalogPolicyAction} className={styles.modalForm}>
              <div className={styles.toggleGrid}>
                <label className={styles.toggleCard}><input name="allowPublicCatalog" type="checkbox" defaultChecked={policy.allow_public_catalog} /><span><strong>Allow public catalogue</strong><small>Expose the public catalogue according to company policy.</small></span></label>
                <label className={styles.toggleCard}><input name="categoryRestriction" type="checkbox" defaultChecked={policy.category_restriction} /><span><strong>Restrict categories</strong><small>Only explicitly allowed category IDs will be available.</small></span></label>
                <label className={styles.toggleCard}><input name="productRestriction" type="checkbox" defaultChecked={policy.product_restriction} /><span><strong>Restrict products</strong><small>Only explicitly allowed product SKUs will be available.</small></span></label>
              </div>
              <div className={styles.formGrid}>
                <div className="field"><label htmlFor="allowedCategoryIds">Allowed category IDs</label><textarea id="allowedCategoryIds" name="allowedCategoryIds" rows={7} defaultValue={policy.allowed_category_ids.join(", ")} placeholder="12, 34, 56" /><span className="muted small-text">Comma-separated category IDs. Fluid validates every category.</span></div>
                <div className="field"><label htmlFor="allowedProductSkus">Allowed product SKUs</label><textarea id="allowedProductSkus" name="allowedProductSkus" rows={7} defaultValue={policy.allowed_products.map((product) => product.sku).join("\n")} placeholder="SKU-001\nSKU-002" /><span className="muted small-text">One SKU per line or comma separated. Fluid resolves every SKU.</span></div>
              </div>
              <div className={styles.modalActions}><button className="button" type="submit">Save company catalogue</button></div>
            </form>
          </PortalModal>
        </div>

        <div className={styles.policyGrid}>
          <article className={styles.policyCard}>
            <div className={styles.policyCardTop}><span className={styles.policyIcon} aria-hidden="true">◎</span><span className={policy.allow_public_catalog ? "badge badge-ok" : "badge badge-neutral"}>{policy.allow_public_catalog ? "Allowed" : "Not allowed"}</span></div>
            <h3>Public catalogue</h3>
            <p>{policy.allow_public_catalog ? "Your company can use the public catalogue within the restrictions below." : "Public catalogue access is disabled for this company."}</p>
          </article>
          <article className={styles.policyCard}>
            <div className={styles.policyCardTop}><span className={styles.policyIcon} aria-hidden="true">▦</span><span className={policy.category_restriction ? "badge badge-neutral" : "badge badge-ok"}>{policy.category_restriction ? `${policy.allowed_category_ids.length} allowed` : "All allowed"}</span></div>
            <h3>Categories</h3>
            <p>{policy.category_restriction ? "Only the selected company categories are available." : "No company-level category restriction is applied."}</p>
          </article>
          <article className={styles.policyCard}>
            <div className={styles.policyCardTop}><span className={styles.policyIcon} aria-hidden="true">□</span><span className={policy.product_restriction ? "badge badge-neutral" : "badge badge-ok"}>{policy.product_restriction ? `${policy.allowed_product_ids.length} allowed` : "All allowed"}</span></div>
            <h3>Products</h3>
            <p>{policy.product_restriction ? "Only the selected company products are available." : "No company-level product restriction is applied."}</p>
          </article>
        </div>

        <div className={styles.selectionGrid}>
          <article className={styles.selectionCard}>
            <div className={styles.selectionHeading}><div><p className="eyebrow">Categories</p><h3>Allowed categories</h3></div><span>{policy.category_restriction ? policy.allowed_categories.length : "All"}</span></div>
            {policy.category_restriction && policy.allowed_categories.length ? (
              <div className={styles.chipList}>{policy.allowed_categories.map((category) => <span className={styles.chip} key={category.category_id} title={category.path}>{category.name}<code>#{category.category_id}</code></span>)}</div>
            ) : <p className="muted">{policy.category_restriction ? "No categories are currently allowed." : "All company categories are available."}</p>}
          </article>
          <article className={styles.selectionCard}>
            <div className={styles.selectionHeading}><div><p className="eyebrow">Products</p><h3>Allowed products</h3></div><span>{policy.product_restriction ? policy.allowed_products.length : "All"}</span></div>
            {policy.product_restriction && policy.allowed_products.length ? (
              <div className={styles.chipList}>{policy.allowed_products.map((product) => <span className={styles.chip} key={product.product_id}>{product.name}<code>{product.sku}</code></span>)}</div>
            ) : <p className="muted">{policy.product_restriction ? "No products are currently allowed." : "All company products are available."}</p>}
          </article>
        </div>
      </section>

      <section className={styles.section} id="role-policy">
        <div className={styles.sectionHeading}>
          <div>
            <p className="eyebrow">Role visibility</p>
            <h2>Role catalogue</h2>
            <p className="muted">A role can only narrow the company catalogue; it can never broaden it.</p>
          </div>
        </div>

        {!selectedRole || !rolePolicy ? (
          <div className={styles.emptyState}><strong>No company roles available</strong><span>A role must be available before role catalogue controls can be configured.</span></div>
        ) : (
          <>
            <form className={styles.roleSelector} method="get">
              <div>
                <label htmlFor="roleId">Company role</label>
                <select id="roleId" name="roleId" defaultValue={selectedRole.role_id}>{administration.control_roles.map((role) => <option key={role.role_id} value={role.role_id}>{role.name}</option>)}</select>
              </div>
              <button className="button button-secondary" type="submit">Open role</button>
              <span className={styles.roleMeta}>Choose a role to review its effective catalogue visibility.</span>
            </form>

            <section className={styles.roleSummary} aria-label={`${selectedRole.name} catalogue summary`}>
              <article><span>Categories</span><strong>{usesAllCompanyCategories ? "All" : rolePolicy.selected_category_ids.length}</strong><small>{usesAllCompanyCategories ? "Uses company categories" : "Role restricted"}</small></article>
              <article><span>Category-scope products</span><strong>{rolePolicy.products_count}</strong><small>Available before product restriction</small></article>
              <article><span>Role products</span><strong>{rolePolicy.preselect_all_products ? "All" : rolePolicy.allowed_product_ids.length}</strong><small>{rolePolicy.preselect_all_products ? "Uses all in category scope" : "Explicitly restricted"}</small></article>
            </section>

            <div className={styles.roleGrid}>
              <article className={styles.roleCard}>
                <div className={styles.roleCardHeader}>
                  <div><p className="eyebrow">{selectedRole.name}</p><h3>Categories</h3></div>
                  <span className={usesAllCompanyCategories ? "badge badge-ok" : "badge badge-neutral"}>{usesAllCompanyCategories ? "All company categories" : "Restricted"}</span>
                </div>
                <p>Choose which company categories this role can use. Selecting a parent selects its full branch.</p>
                <div className={styles.roleCardFooter}>
                  {!usesAllCompanyCategories ? (
                    <form action={savePortalRoleCategoriesAction} className={styles.quickAction}>
                      <input name="roleId" type="hidden" value={selectedRole.role_id} />
                      {allCategoryIds.map((id) => <input key={id} name="categoryIds" type="hidden" value={id} />)}
                      <button className="button button-secondary" type="submit">Use all categories</button>
                    </form>
                  ) : <span className={styles.statusCopy}>No extra role category restriction.</span>}
                  <PortalModal
                    title={`${selectedRole.name} categories`}
                    description="Search the company category tree and choose the categories available to this role."
                    triggerLabel="Manage categories"
                    triggerHint={usesAllCompanyCategories ? "Currently all company categories" : `${rolePolicy.selected_category_ids.length} selected`}
                    triggerIcon="edit"
                  >
                    <form action={savePortalRoleCategoriesAction} className={styles.modalForm}>
                      <input name="roleId" type="hidden" value={selectedRole.role_id} />
                      <CatalogCategoryPicker nodes={rolePolicy.category_tree} selectedCategoryIds={rolePolicy.selected_category_ids} label={`${selectedRole.name} categories`} />
                      <div className={styles.modalActions}><button className="button" type="submit">Save role categories</button></div>
                    </form>
                  </PortalModal>
                </div>
              </article>

              <article className={styles.roleCard} id="role-products">
                <div className={styles.roleCardHeader}>
                  <div><p className="eyebrow">{selectedRole.name}</p><h3>Products</h3></div>
                  <span className={rolePolicy.preselect_all_products ? "badge badge-ok" : "badge badge-neutral"}>{rolePolicy.preselect_all_products ? "All in categories" : "Restricted"}</span>
                </div>
                <p>Product access stays inside both the company catalogue and this role&apos;s selected categories.</p>
                {!rolePolicy.has_saved_categories ? (
                  <form action={savePortalRoleCategoriesAction} className={styles.setupCard}>
                    <input name="roleId" type="hidden" value={selectedRole.role_id} />
                    {allCategoryIds.map((id) => <input key={id} name="categoryIds" type="hidden" value={id} />)}
                    <div><strong>Save category state first</strong><span>Products can be configured after the role has a saved category state.</span></div>
                    <button className="button" type="submit">Use company categories</button>
                  </form>
                ) : (
                  <div className={styles.roleCardFooter}>
                    {!rolePolicy.preselect_all_products ? (
                      <form action={savePortalRoleProductsAction} className={styles.quickAction}>
                        <input name="roleId" type="hidden" value={selectedRole.role_id} />
                        <input name="productMode" type="hidden" value="all" />
                        <button className="button button-secondary" type="submit">Use all products</button>
                      </form>
                    ) : <span className={styles.statusCopy}>No extra role product restriction.</span>}
                    <PortalModal
                      title={`${selectedRole.name} products`}
                      description="Choose the products available to this role within its current company and category boundaries."
                      triggerLabel="Manage products"
                      triggerHint={rolePolicy.preselect_all_products ? "Currently all in category scope" : `${rolePolicy.allowed_product_ids.length} selected`}
                      triggerIcon="edit"
                    >
                      {canUseCompanyProductChecklist ? (
                        <form action={savePortalRoleProductsAction} className={styles.modalForm}>
                          <input name="roleId" type="hidden" value={selectedRole.role_id} />
                          <input name="productMode" type="hidden" value="explicit" />
                          <CatalogProductPicker products={policy.allowed_products.map((product) => ({ id: product.product_id, sku: product.sku, name: product.name }))} selectedProductIds={rolePolicy.allowed_product_ids} preselectAll={rolePolicy.preselect_all_products} label={`${selectedRole.name} products`} />
                          <div className={styles.modalActions}><button className="button" type="submit">Save role products</button></div>
                        </form>
                      ) : (
                        <div className={styles.productModes}>
                          <form action={savePortalRoleProductsAction} className={styles.modeCard}>
                            <input name="roleId" type="hidden" value={selectedRole.role_id} />
                            <input name="productMode" type="hidden" value="all" />
                            <div><strong>All products in selected categories</strong><span>No additional role-level product allowlist.</span></div>
                            <button className="button button-secondary" type="submit">Use all products</button>
                          </form>
                          <form action={savePortalRoleProductsAction} className={styles.modeCard}>
                            <input name="roleId" type="hidden" value={selectedRole.role_id} />
                            <input name="productMode" type="hidden" value="explicit" />
                            <div className="field"><label htmlFor={`allowedProductIds-${selectedRole.role_id}`}>Explicit product IDs</label><textarea id={`allowedProductIds-${selectedRole.role_id}`} name="allowedProductIds" rows={7} defaultValue={rolePolicy.allowed_product_ids.join(", ")} /></div>
                            <span className="muted small-text">Fluid validates every product against this role&apos;s category scope.</span>
                            <button className="button" type="submit">Save explicit products</button>
                          </form>
                        </div>
                      )}
                    </PortalModal>
                  </div>
                )}
              </article>
            </div>

            {rolePolicy.show_product_grid ? (
              <section className={styles.effectiveSection} id="effective-products">
                <details className={styles.effectivePanel}>
                  <summary><span><strong>Verify effective products</strong><small>Search the backend-returned product grid for {selectedRole.name}.</small></span><span aria-hidden="true">＋</span></summary>
                  <div className={styles.effectiveBody}>
                    <form className={styles.searchBar} method="get">
                      <input name="roleId" type="hidden" value={selectedRole.role_id} />
                      <div className="field grow"><label htmlFor="roleProductSearch">Product search</label><input id="roleProductSearch" name="roleProductSearch" defaultValue={roleProductSearch} placeholder="SKU or product name" /></div>
                      <button className="button button-secondary" type="submit">Search</button>
                    </form>
                    <div className={styles.productTable}>
                      <div className={`${styles.productRow} ${styles.tableHeader}`} aria-hidden="true"><span>Product</span><span>SKU</span><span>ID</span><span>Effective access</span></div>
                      {rolePolicy.products.items.map((product) => <div className={styles.productRow} key={product.id}><strong>{product.name}</strong><code>{product.sku}</code><span>{product.id}</span><span><span className={product.allowed ? "badge badge-ok" : "badge badge-neutral"}>{product.allowed ? "Allowed" : "Not allowed"}</span></span></div>)}
                      {!rolePolicy.products.items.length ? <div className={styles.emptyProductRow}>No matching products.</div> : null}
                    </div>
                    <div className={styles.pagination}><span>Page {rolePolicy.products.page} of {totalProductPages} · {rolePolicy.products.total_count} products</span><div>{rolePolicy.products.page > 1 ? <Link className="button button-secondary button-link" href={productPageHref(selectedRole.role_id, rolePolicy.products.page - 1, roleProductSearch)}>Previous</Link> : null}{rolePolicy.products.page < totalProductPages ? <Link className="button button-secondary button-link" href={productPageHref(selectedRole.role_id, rolePolicy.products.page + 1, roleProductSearch)}>Next</Link> : null}</div></div>
                  </div>
                </details>
              </section>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
