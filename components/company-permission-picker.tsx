"use client";

import { useMemo, useState } from "react";

export type CompanyPermissionResource = {
  resource_id: string;
  title: string;
  parent_resource_id: string | null;
  depth: number;
  assignable: boolean;
};

type ResourceNode = CompanyPermissionResource & {
  children: ResourceNode[];
  path: string;
};

type Props = {
  resources: CompanyPermissionResource[];
  selectedResourceIds?: string[];
  label?: string;
};

function normalized(value: string) {
  return value.trim().toLocaleLowerCase("en");
}

function buildTree(resources: CompanyPermissionResource[]) {
  const byId = new Map<string, ResourceNode>();
  resources.forEach((resource) => byId.set(resource.resource_id, { ...resource, children: [], path: resource.title }));

  const roots: ResourceNode[] = [];
  for (const resource of resources) {
    const node = byId.get(resource.resource_id)!;
    const parent = resource.parent_resource_id ? byId.get(resource.parent_resource_id) : null;
    if (parent && parent.resource_id !== node.resource_id) parent.children.push(node);
    else roots.push(node);
  }

  const visiting = new Set<string>();
  function attachPaths(node: ResourceNode, parentPath = "") {
    if (visiting.has(node.resource_id)) return;
    visiting.add(node.resource_id);
    node.path = parentPath ? `${parentPath} > ${node.title}` : node.title;
    node.children.forEach((child) => attachPaths(child, node.path));
    visiting.delete(node.resource_id);
  }
  roots.forEach((root) => attachPaths(root));
  return roots;
}

function allBranchIds(nodes: ResourceNode[]) {
  const ids: string[] = [];
  function visit(node: ResourceNode) {
    if (node.children.length) ids.push(node.resource_id);
    node.children.forEach(visit);
  }
  nodes.forEach(visit);
  return ids;
}

function rootBranchIds(nodes: ResourceNode[]) {
  return nodes.filter((node) => node.children.length).map((node) => node.resource_id);
}

function assignableIds(node: ResourceNode) {
  const ids: string[] = [];
  function visit(current: ResourceNode) {
    if (current.assignable) ids.push(current.resource_id);
    current.children.forEach(visit);
  }
  visit(node);
  return ids;
}

function branchMatches(node: ResourceNode, query: string): boolean {
  if (!query) return true;
  const ownText = normalized(`${node.title} ${node.resource_id} ${node.path}`);
  return ownText.includes(query) || node.children.some((child) => branchMatches(child, query));
}

export function CompanyPermissionPicker({ resources, selectedResourceIds = [], label = "Permissions" }: Props) {
  const tree = useMemo(() => buildTree(resources), [resources]);
  const branchIds = useMemo(() => allBranchIds(tree), [tree]);
  const initialOpen = useMemo(() => rootBranchIds(tree), [tree]);
  const assignable = useMemo(() => resources.filter((resource) => resource.assignable), [resources]);
  const [selected, setSelected] = useState(() => new Set(selectedResourceIds));
  const [openBranches, setOpenBranches] = useState(() => new Set(initialOpen));
  const [query, setQuery] = useState("");
  const search = normalized(query);

  const selectedAssignable = assignable.reduce((total, resource) => total + (selected.has(resource.resource_id) ? 1 : 0), 0);

  function toggleResource(resourceId: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(resourceId);
      else next.delete(resourceId);
      return next;
    });
  }

  function toggleBranch(resourceId: string) {
    setOpenBranches((current) => {
      const next = new Set(current);
      if (next.has(resourceId)) next.delete(resourceId);
      else next.add(resourceId);
      return next;
    });
  }

  function setBranchSelection(node: ResourceNode, checked: boolean) {
    const ids = assignableIds(node);
    setSelected((current) => {
      const next = new Set(current);
      ids.forEach((id) => checked ? next.add(id) : next.delete(id));
      return next;
    });
  }

  function renderNode(node: ResourceNode, level = 0): React.ReactNode {
    if (search && !branchMatches(node, search)) return null;
    const hasChildren = node.children.length > 0;
    const open = search ? true : openBranches.has(node.resource_id);
    const branchAssignableIds = hasChildren ? assignableIds(node) : [];
    const branchSelected = branchAssignableIds.filter((id) => selected.has(id)).length;

    return (
      <div className={`permission-node ${level === 0 ? "permission-node-root" : ""}`} key={node.resource_id}>
        <div className="permission-row" style={{ "--permission-depth": Math.min(level, 7) } as React.CSSProperties}>
          {hasChildren ? (
            <button
              className="permission-toggle"
              type="button"
              aria-expanded={open}
              aria-label={`${open ? "Collapse" : "Expand"} ${node.title}`}
              onClick={() => toggleBranch(node.resource_id)}
            >
              <span aria-hidden="true">›</span>
            </button>
          ) : <span className="permission-toggle-spacer" aria-hidden="true" />}

          {node.assignable ? (
            <input
              aria-label={node.path}
              name="allowedResources"
              type="checkbox"
              value={node.resource_id}
              checked={selected.has(node.resource_id)}
              onChange={(event) => toggleResource(node.resource_id, event.target.checked)}
            />
          ) : (
            <>
              <input type="checkbox" checked={selected.has(node.resource_id)} disabled readOnly aria-label={`${node.path} protected`} />
              {selected.has(node.resource_id) ? <input name="allowedResources" type="hidden" value={node.resource_id} /> : null}
            </>
          )}

          <span className="permission-title">
            <strong>{node.title}</strong>
            <small>{node.resource_id}</small>
          </span>

          {!node.assignable ? <span className="badge badge-neutral permission-protected">Protected</span> : null}

          {hasChildren ? (
            <span className="permission-branch-actions">
              <span className="permission-branch-count">{branchSelected}/{branchAssignableIds.length}</span>
              {branchAssignableIds.length ? (
                <>
                  <button className="permission-text-button" type="button" onClick={() => setBranchSelection(node, true)}>Select group</button>
                  <button className="permission-text-button" type="button" onClick={() => setBranchSelection(node, false)}>Clear</button>
                </>
              ) : null}
            </span>
          ) : null}
        </div>

        {hasChildren && open ? (
          <div className="permission-children">
            {node.children.map((child) => renderNode(child, level + 1))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="permission-picker">
      <div className="permission-picker-toolbar">
        <div>
          <strong>{label}</strong>
          <span className="muted small-text">{selectedAssignable} of {assignable.length} assignable permissions selected</span>
        </div>
        <div className="permission-picker-actions">
          <button className="button button-secondary button-compact" type="button" onClick={() => setOpenBranches(new Set(branchIds))}>Expand all</button>
          <button className="button button-secondary button-compact" type="button" onClick={() => setOpenBranches(new Set(initialOpen))}>Collapse</button>
        </div>
      </div>

      <div className="field permission-search-field">
        <label htmlFor={`permission-search-${label.replaceAll(" ", "-").toLowerCase()}`}>Find a permission</label>
        <input
          id={`permission-search-${label.replaceAll(" ", "-").toLowerCase()}`}
          type="search"
          value={query}
          placeholder="Search by title or resource ID"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="permission-tree">
        {tree.map((root) => renderNode(root))}
        {search && !tree.some((root) => branchMatches(root, search)) ? <p className="muted permission-empty">No permissions match “{query}”.</p> : null}
      </div>
    </div>
  );
}
