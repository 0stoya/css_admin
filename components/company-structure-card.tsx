import Link from "next/link";
import {
  countStructureCompanies,
  findCompanyStructureContext,
  type CompanyStructureNode,
} from "@/lib/company-structure";

function CrownIcon() {
  return (
    <svg className="company-crown" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7Z" />
      <path d="M5 20h14" />
    </svg>
  );
}

function StructureTree({
  nodes,
  currentCompanyId,
}: {
  nodes: CompanyStructureNode[];
  currentCompanyId: number;
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
                <Link href={`/companies/${node.company.company_id}`} aria-current={current ? "page" : undefined}>
                  {node.company.name}
                </Link>
                <span>{node.company.reference || `Company ${node.company.company_id}`}</span>
              </div>
              {current ? <span className="badge badge-ok">Current company</span> : null}
            </div>
            {node.children.length ? <StructureTree nodes={node.children} currentCompanyId={currentCompanyId} /> : null}
          </li>
        );
      })}
    </ul>
  );
}

export function CompanyStructureCard({
  roots,
  companyId,
}: {
  roots: CompanyStructureNode[];
  companyId: number;
}) {
  const context = findCompanyStructureContext(roots, companyId);
  if (!context) return null;

  const root = context.root;
  const companyCount = countStructureCompanies(root);
  const isIndependent = companyCount === 1 && root.company.parent_company_id === null;
  const canonicalRoot = root.company.parent_company_id === null;

  return (
    <section className="card company-structure-card stack">
      <div className="company-structure-card-heading">
        <div className={`company-root-marker${!isIndependent && canonicalRoot ? " company-root-marker-parent" : ""}`}>
          {!isIndependent && canonicalRoot ? <CrownIcon /> : <span className="company-building-mark" aria-hidden="true" />}
        </div>
        <div>
          <p className="eyebrow">Company structure</p>
          <h2>{isIndependent ? "Independent company" : root.company.name}</h2>
          <p className="muted">
            {isIndependent
              ? "This company is not currently linked to a parent or child company in your visible scope."
              : canonicalRoot
                ? `${root.company.reference || root.company.name} is the group head for ${companyCount} visible companies.`
                : `This is the highest visible branch in your current admin scope. Its parent company is outside the visible company set.`}
          </p>
        </div>
        {!isIndependent ? <span className="badge badge-neutral">{companyCount} companies</span> : null}
      </div>

      {context.path.length > 1 ? (
        <nav className="company-structure-path" aria-label="Company structure path">
          {context.path.map((node, index) => (
            <span key={node.company.company_id}>
              {index ? <span aria-hidden="true">›</span> : null}
              <Link
                href={`/companies/${node.company.company_id}`}
                aria-current={node.company.company_id === companyId ? "page" : undefined}
              >
                {node.company.reference || node.company.name}
              </Link>
            </span>
          ))}
        </nav>
      ) : null}

      {!isIndependent ? (
        <div className="company-tree-panel company-detail-tree-panel">
          <div className={`company-tree-row company-tree-root${root.company.company_id === companyId ? " company-tree-current" : ""}`}>
            <span className="company-tree-root-line" aria-hidden="true" />
            <div className="company-tree-company">
              <Link href={`/companies/${root.company.company_id}`}>{root.company.name}</Link>
              <span>{root.company.reference || `Company ${root.company.company_id}`} · Group head</span>
            </div>
            {root.company.company_id === companyId ? <span className="badge badge-ok">Current company</span> : null}
          </div>
          <StructureTree nodes={root.children} currentCompanyId={companyId} />
        </div>
      ) : null}
    </section>
  );
}
