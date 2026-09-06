import type { CompanySummary } from "@/lib/graphql/companies";

export type CompanyStructureNode = {
  company: CompanySummary;
  children: CompanyStructureNode[];
  descendant_count: number;
};

export type CompanyStructureContext = {
  root: CompanyStructureNode;
  node: CompanyStructureNode;
  path: CompanyStructureNode[];
};

function sortKey(company: CompanySummary) {
  return `${company.reference ?? ""}\u0000${company.name}\u0000${company.company_id}`.toLocaleLowerCase();
}

function sortNodes(nodes: CompanyStructureNode[]) {
  nodes.sort((left, right) => sortKey(left.company).localeCompare(sortKey(right.company)));
  for (const node of nodes) sortNodes(node.children);
}

function wouldCreateCycle(
  childId: number,
  parentId: number,
  companiesById: Map<number, CompanySummary>,
) {
  const visited = new Set<number>();
  let currentId: number | null = parentId;

  while (currentId !== null && !visited.has(currentId)) {
    if (currentId === childId) return true;
    visited.add(currentId);
    currentId = companiesById.get(currentId)?.parent_company_id ?? null;
  }

  return false;
}

function countDescendants(node: CompanyStructureNode): number {
  node.descendant_count = node.children.reduce(
    (total, child) => total + 1 + countDescendants(child),
    0,
  );
  return node.descendant_count;
}

export function buildCompanyStructure(companies: CompanySummary[]) {
  const companiesById = new Map(companies.map((company) => [company.company_id, company]));
  const nodesById = new Map<number, CompanyStructureNode>(
    companies.map((company) => [
      company.company_id,
      { company, children: [], descendant_count: 0 },
    ]),
  );
  const attached = new Set<number>();

  for (const company of companies) {
    const parentId = company.parent_company_id;
    if (
      parentId === null ||
      parentId === company.company_id ||
      !nodesById.has(parentId) ||
      wouldCreateCycle(company.company_id, parentId, companiesById)
    ) {
      continue;
    }

    nodesById.get(parentId)!.children.push(nodesById.get(company.company_id)!);
    attached.add(company.company_id);
  }

  const roots = companies
    .filter((company) => !attached.has(company.company_id))
    .map((company) => nodesById.get(company.company_id)!);

  sortNodes(roots);
  for (const root of roots) countDescendants(root);

  return roots;
}

export function countStructureCompanies(node: CompanyStructureNode) {
  return node.descendant_count + 1;
}

export function findCompanyStructureContext(
  roots: CompanyStructureNode[],
  companyId: number,
): CompanyStructureContext | null {
  function visit(
    root: CompanyStructureNode,
    node: CompanyStructureNode,
    path: CompanyStructureNode[],
  ): CompanyStructureContext | null {
    const nextPath = [...path, node];
    if (node.company.company_id === companyId) {
      return { root, node, path: nextPath };
    }

    for (const child of node.children) {
      const found = visit(root, child, nextPath);
      if (found) return found;
    }

    return null;
  }

  for (const root of roots) {
    const found = visit(root, root, []);
    if (found) return found;
  }

  return null;
}
