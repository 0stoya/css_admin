"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CompanyStructureNode } from "@/lib/company-structure";
import { countStructureCompanies } from "@/lib/company-structure";

function CrownIcon() {
  return (
    <svg className="company-crown" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7Z" />
      <path d="M5 20h14" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg className={`company-chevron${expanded ? " company-chevron-open" : ""}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function companyMatches(node: CompanyStructureNode, query: string): boolean {
  const company = node.company;
  const ownValue = [company.name, company.reference ?? "", String(company.company_id)]
    .join(" ")
    .toLocaleLowerCase();

  return ownValue.includes(query) || node.children.some((child) => companyMatches(child, query));
}

function isDirectMatch(node: CompanyStructureNode, query: string) {
  if (!query) return false;
  const company = node.company;
  return [company.name, company.reference ?? "", String(company.company_id)]
    .join(" ")
    .toLocaleLowerCase()
    .includes(query);
}

function CompanyTree({
  nodes,
  query,
}: {
  nodes: CompanyStructureNode[];
  query: string;
}) {
  return (
    <ul className="company-tree-list">
      {nodes.map((node) => (
        <li className="company-tree-item" key={node.company.company_id}>
          <div className={`company-tree-row${isDirectMatch(node, query) ? " company-tree-match" : ""}`}>
            <span className="company-tree-connector" aria-hidden="true" />
            <div className="company-tree-company">
              <Link href={`/companies/${node.company.company_id}`}>{node.company.name}</Link>
              <span>{node.company.reference || `Company ${node.company.company_id}`}</span>
            </div>
            {node.children.length ? (
              <span className="badge badge-neutral">
                {countStructureCompanies(node)} in branch
              </span>
            ) : null}
          </div>
          {node.children.length ? <CompanyTree nodes={node.children} query={query} /> : null}
        </li>
      ))}
    </ul>
  );
}

export function CompanyDirectory({ roots }: { roots: CompanyStructureNode[] }) {
  const [query, setQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<number[]>([]);
  const normalizedQuery = query.trim().toLocaleLowerCase();

  const filteredRoots = useMemo(
    () => normalizedQuery ? roots.filter((root) => companyMatches(root, normalizedQuery)) : roots,
    [normalizedQuery, roots],
  );

  function toggle(companyId: number) {
    setExpandedIds((current) =>
      current.includes(companyId)
        ? current.filter((id) => id !== companyId)
        : [...current, companyId],
    );
  }

  return (
    <section className="company-directory stack">
      <div className="company-directory-toolbar">
        <div className="field grow">
          <label htmlFor="company-search">Find a company</label>
          <input
            id="company-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by company name, reference or ID"
          />
        </div>
        <div className="company-directory-summary" aria-live="polite">
          {filteredRoots.length} visible structure{filteredRoots.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="company-group-list">
        {filteredRoots.map((root) => {
          const company = root.company;
          const hasChildren = root.children.length > 0;
          const isCanonicalRoot = company.parent_company_id === null;
          const expanded = normalizedQuery ? hasChildren : expandedIds.includes(company.company_id);
          const totalInStructure = countStructureCompanies(root);

          return (
            <article className={`company-group${expanded ? " company-group-expanded" : ""}`} key={company.company_id}>
              <div className="company-group-row">
                <button
                  className="company-structure-toggle"
                  type="button"
                  onClick={() => hasChildren && toggle(company.company_id)}
                  aria-expanded={hasChildren ? expanded : undefined}
                  aria-controls={hasChildren ? `company-tree-${company.company_id}` : undefined}
                  disabled={!hasChildren}
                  title={hasChildren ? (expanded ? "Hide company structure" : "View company structure") : "Independent company"}
                >
                  {hasChildren ? <ChevronIcon expanded={expanded} /> : <span className="company-structure-dot" />}
                </button>

                <div className={`company-root-marker${hasChildren && isCanonicalRoot ? " company-root-marker-parent" : ""}`}>
                  {hasChildren && isCanonicalRoot ? <CrownIcon /> : <span className="company-building-mark" aria-hidden="true" />}
                </div>

                <div className="company-group-identity">
                  <div className="company-group-title-row">
                    <Link className="company-group-title" href={`/companies/${company.company_id}`}>{company.name}</Link>
                    {hasChildren && isCanonicalRoot ? <span className="company-parent-label">Group head</span> : null}
                  </div>
                  <div className="company-group-meta">
                    <strong>{company.reference || `Company ${company.company_id}`}</strong>
                    <span>Company ID {company.company_id}</span>
                    <span>Sales rep {company.sales_representative_id ?? "unassigned"}</span>
                  </div>
                </div>

                <div className="company-group-actions">
                  {hasChildren ? (
                    <button className="company-structure-action" type="button" onClick={() => toggle(company.company_id)}>
                      {expanded ? "Hide structure" : `View structure · ${totalInStructure}`}
                    </button>
                  ) : (
                    <span className="badge badge-neutral">Independent</span>
                  )}
                  <Link className="button button-secondary button-compact" href={`/companies/${company.company_id}`}>Open</Link>
                </div>
              </div>

              {hasChildren && expanded ? (
                <div className="company-tree-panel" id={`company-tree-${company.company_id}`}>
                  <div className="company-tree-head">
                    <div>
                      <span className="company-tree-kicker">Company structure</span>
                      <strong>{company.reference || company.name}</strong>
                    </div>
                    <span>{totalInStructure - 1} child compan{totalInStructure - 1 === 1 ? "y" : "ies"}</span>
                  </div>
                  <CompanyTree nodes={root.children} query={normalizedQuery} />
                </div>
              ) : null}
            </article>
          );
        })}

        {!filteredRoots.length ? (
          <div className="card company-directory-empty">
            <strong>No companies match “{query.trim()}”.</strong>
            <span>Try a company name, CREF/reference or Magento company ID.</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
