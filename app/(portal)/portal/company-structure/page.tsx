import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import styles from "@/components/portal/portal-company-structure.module.css";
import { selectPortalCompanyAction } from "../actions";
import {
  buildCompanyStructure,
  countStructureCompanies,
  findCompanyStructureContext,
  type CompanyStructureNode,
} from "@/lib/company-structure";
import {
  getCompanyPortalAdministration,
  getCompanyPortalContext,
  getCompanyPortalStructure,
  type CompanyPortalStructure,
} from "@/lib/graphql/company-portal";

function buildPortalStructure(structure: CompanyPortalStructure) {
  return buildCompanyStructure(
    structure.companies.map((company) => ({
      company_id: company.company_id,
      reference: company.reference,
      status: company.active,
      name: company.name || `Company ${company.company_id}`,
      sales_representative_id: null,
      parent_company_id: company.parent_company_id,
    })),
  );
}

function CrownIcon() {
  return (
    <svg className="company-crown" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7Z" />
      <path d="M5 20h14" />
    </svg>
  );
}

function SwitchCompanyControl({
  companyId,
  current,
  switchable,
}: {
  companyId: number;
  current: boolean;
  switchable: boolean;
}) {
  if (current) {
    return <span className="badge badge-ok">Current company</span>;
  }

  if (!switchable) return null;

  return (
    <form action={selectPortalCompanyAction} className={styles.switchForm}>
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="returnTo" value="/portal/company-structure" />
      <button className={styles.switchButton} type="submit">Switch</button>
    </form>
  );
}

function StructureTree({
  nodes,
  currentCompanyId,
  switchableCompanyIds,
}: {
  nodes: CompanyStructureNode[];
  currentCompanyId: number;
  switchableCompanyIds: number[];
}) {
  return (
    <ul className="company-tree-list company-detail-tree">
      {nodes.map((node) => {
        const current = node.company.company_id === currentCompanyId;
        return (
          <li className="company-tree-item" key={node.company.company_id}>
            <div className={`company-tree-row${current ? " company-tree-current" : ""}`}>
              <span className="company-tree-connector" aria-hidden="true" />
              <div className="company-tree-company">
                <strong className={styles.companyName}>{node.company.name}</strong>
                <span>
                  {node.company.reference || `Company ${node.company.company_id}`}
                  {node.children.length ? ` · ${node.descendant_count + 1} in branch` : ""}
                </span>
              </div>
              <SwitchCompanyControl
                companyId={node.company.company_id}
                current={current}
                switchable={switchableCompanyIds.includes(node.company.company_id)}
              />
            </div>
            {node.children.length ? (
              <StructureTree
                nodes={node.children}
                currentCompanyId={currentCompanyId}
                switchableCompanyIds={switchableCompanyIds}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export default async function PortalCompanyStructurePage() {
  const [contextResult, administrationResult] = await Promise.allSettled([
    getCompanyPortalContext(),
    getCompanyPortalAdministration(),
  ]);

  const context = contextResult.status === "fulfilled" ? contextResult.value : null;
  const administration = administrationResult.status === "fulfilled"
    ? administrationResult.value
    : null;
  const selected = context?.companies.find((company) => company.selected) ?? null;

  if (!selected) {
    redirect("/portal");
  }

  if (
    !administration?.is_company_admin
    || administration.company_id !== selected.company_id
  ) {
    notFound();
  }

  let structure: CompanyPortalStructure | null = null;
  try {
    structure = await getCompanyPortalStructure();
  } catch {
    structure = null;
  }

  const roots = structure ? buildPortalStructure(structure) : [];
  const structureContext = structure
    ? findCompanyStructureContext(roots, selected.company_id)
    : null;

  if (!structure || !structureContext) {
    return (
      <div className={styles.page}>
        <Link className={styles.backLink} href="/portal/company-profile">
          <span aria-hidden="true">←</span> Company profile
        </Link>
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <span className={styles.kicker}>{selected.reference || "Your company"}</span>
            <h1>Company structure</h1>
            <p>View the companies linked within your organisation.</p>
          </div>
          <span className={styles.readOnly}>Read only</span>
        </header>
        <section className={styles.unavailable}>
          <h2>Company structure is unavailable</h2>
          <p>Your company account and the rest of the Portal remain available normally.</p>
        </section>
      </div>
    );
  }

  const root = structureContext.root;
  const companyCount = countStructureCompanies(root);
  const independent = companyCount === 1 && root.company.parent_company_id === null;
  const canonicalRoot = root.company.parent_company_id === null;
  const currentIsRoot = root.company.company_id === selected.company_id;
  const switchableCompanyIds = context?.companies.map((company) => company.company_id) ?? [];
  const rootLabel = independent
    ? "Independent company"
    : canonicalRoot
      ? "Group head"
      : "Highest visible branch";
  const currentPositionLabel = independent
    ? "Independent company"
    : currentIsRoot
      ? rootLabel
      : "Group company";

  return (
    <div className={styles.page}>
      <Link className={styles.backLink} href="/portal/company-profile">
        <span aria-hidden="true">←</span> Company profile
      </Link>

      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <span className={styles.kicker}>{selected.reference || "Your company"}</span>
          <h1>Company structure</h1>
          <p>See where your current company sits within the wider organisation.</p>
        </div>
        <span className={styles.readOnly}>Read only</span>
      </header>

      <section className={styles.summary} aria-label="Company structure summary">
        <article className={styles.summaryCard}>
          <span className={styles.summaryValue}>{companyCount}</span>
          <span className={styles.summaryLabel}>
            Compan{companyCount === 1 ? "y" : "ies"} in structure
          </span>
        </article>
        <article className={styles.summaryCard}>
          <span className={styles.summaryValue}>{selected.reference || "—"}</span>
          <span className={styles.summaryLabel}>Current company</span>
        </article>
        <article className={styles.summaryCard}>
          <span className={styles.summaryValue}>{currentPositionLabel}</span>
          <span className={styles.summaryLabel}>Structure position</span>
        </article>
      </section>

      <section className={styles.structureCard} aria-labelledby="portal-company-structure-heading">
        <div className={styles.structureHeading}>
          <div className={`company-root-marker${!independent && canonicalRoot ? " company-root-marker-parent" : ""}`}>
            {!independent && canonicalRoot
              ? <CrownIcon />
              : <span className="company-building-mark" aria-hidden="true" />}
          </div>
          <div>
            <p className="eyebrow">Company structure</p>
            <h2 id="portal-company-structure-heading">
              {independent ? "Independent company" : root.company.name}
            </h2>
            <p>
              {independent
                ? "This company is not linked to another company in your visible structure."
                : canonicalRoot
                  ? `${root.company.reference || root.company.name} is the group head for ${companyCount} visible companies.`
                  : "This is the highest company available in your visible structure."}
            </p>
          </div>
          {!independent ? (
            <span className={styles.companyCount}>
              {companyCount} companies
            </span>
          ) : null}
        </div>

        {!independent ? (
          <div className="company-tree-panel company-detail-tree-panel">
            <div className={`company-tree-row company-tree-root${root.company.company_id === selected.company_id ? " company-tree-current" : ""}`}>
              <span className="company-tree-root-line" aria-hidden="true" />
              <div className="company-tree-company">
                <strong className={styles.companyName}>{root.company.name}</strong>
                <span>
                  {root.company.reference || `Company ${root.company.company_id}`} · {rootLabel}
                </span>
              </div>
              <SwitchCompanyControl
                companyId={root.company.company_id}
                current={root.company.company_id === selected.company_id}
                switchable={switchableCompanyIds.includes(root.company.company_id)}
              />
            </div>
            <StructureTree
              nodes={root.children}
              currentCompanyId={selected.company_id}
              switchableCompanyIds={switchableCompanyIds}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
