"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

export type CatalogCategoryPickerNode = {
  id: number;
  label: string;
  parent_id: number;
  is_label_duplicated: boolean;
  descendant_ids: number[];
  children: CatalogCategoryPickerNode[];
};

type TreeNode = Omit<CatalogCategoryPickerNode, "children"> & {
  path: string;
  children: TreeNode[];
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("en");
}

function withPaths(nodes: CatalogCategoryPickerNode[], parentPath = ""): TreeNode[] {
  return nodes.map((node) => {
    const path = parentPath ? `${parentPath} > ${node.label}` : node.label;
    return {
      ...node,
      path,
      children: withPaths(node.children ?? [], path),
    };
  });
}

function branchIds(node: TreeNode) {
  const ids = new Set<number>([node.id, ...(node.descendant_ids ?? [])]);
  const visit = (current: TreeNode) => {
    ids.add(current.id);
    current.children.forEach(visit);
  };
  visit(node);
  return Array.from(ids).filter((id) => id > 0);
}

function branchNodeIds(nodes: TreeNode[]) {
  const ids: number[] = [];
  const visit = (node: TreeNode) => {
    if (node.children.length) ids.push(node.id);
    node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return ids;
}

function rootBranchIds(nodes: TreeNode[]) {
  return nodes.filter((node) => node.children.length).map((node) => node.id);
}

function matches(node: TreeNode, query: string): boolean {
  if (!query) return true;
  const own = normalize(`${node.label} ${node.id} ${node.path}`);
  return own.includes(query) || node.children.some((child) => matches(child, query));
}

function BranchCheckbox({
  checked,
  indeterminate,
  label,
  name,
  value,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  label: string;
  name: string;
  value: number;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      aria-label={label}
      name={name}
      type="checkbox"
      value={value}
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
    />
  );
}

export function CatalogCategoryPicker({
  nodes,
  selectedCategoryIds = [],
  fieldName = "categoryIds",
  label = "Categories",
}: {
  nodes: CatalogCategoryPickerNode[];
  selectedCategoryIds?: number[];
  fieldName?: string;
  label?: string;
}) {
  const searchId = useId();
  const tree = useMemo(() => withPaths(nodes), [nodes]);
  const allIds = useMemo(() => {
    const ids: number[] = [];
    const visit = (node: TreeNode) => {
      if (node.id > 0) ids.push(node.id);
      node.children.forEach(visit);
    };
    tree.forEach(visit);
    return Array.from(new Set(ids));
  }, [tree]);
  const allBranches = useMemo(() => branchNodeIds(tree), [tree]);
  const initialOpen = useMemo(() => rootBranchIds(tree), [tree]);
  const [selected, setSelected] = useState(() => new Set(selectedCategoryIds));
  const [open, setOpen] = useState(() => new Set(initialOpen));
  const [query, setQuery] = useState("");
  const search = normalize(query);

  function setBranch(node: TreeNode, checked: boolean) {
    const ids = branchIds(node);
    setSelected((current) => {
      const next = new Set(current);
      ids.forEach((id) => {
        if (checked) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  }

  function toggleOpen(id: number) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderNode(node: TreeNode, depth = 0): ReactNode {
    if (search && !matches(node, search)) return null;
    const ids = branchIds(node);
    const selectedCount = ids.filter((id) => selected.has(id)).length;
    const checked = ids.length > 0 && selectedCount === ids.length;
    const indeterminate = selectedCount > 0 && selectedCount < ids.length;
    const hasChildren = node.children.length > 0;
    const isOpen = search ? true : open.has(node.id);

    return (
      <div className="catalog-category-node" key={node.id}>
        <div className="catalog-category-row" style={{ "--catalog-depth": Math.min(depth, 8) } as CSSProperties}>
          {hasChildren ? (
            <button
              className="catalog-category-toggle"
              type="button"
              aria-expanded={isOpen}
              aria-label={`${isOpen ? "Collapse" : "Expand"} ${node.label}`}
              onClick={() => toggleOpen(node.id)}
            >
              <span aria-hidden="true">›</span>
            </button>
          ) : <span className="catalog-category-toggle-spacer" aria-hidden="true" />}

          <BranchCheckbox
            checked={checked}
            indeterminate={indeterminate}
            label={node.path}
            name={fieldName}
            value={node.id}
            onChange={(next) => setBranch(node, next)}
          />

          <span className="catalog-category-title">
            <strong>{node.label}</strong>
            <small>{node.is_label_duplicated ? node.path : `Category #${node.id}`}</small>
          </span>

          {hasChildren ? (
            <span className="catalog-category-count">{selectedCount}/{ids.length}</span>
          ) : null}
        </div>

        {hasChildren && isOpen ? (
          <div className="catalog-category-children">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  }

  const selectedCount = allIds.filter((id) => selected.has(id)).length;

  return (
    <div className="catalog-picker">
      <div className="catalog-picker-toolbar">
        <div>
          <strong>{label}</strong>
          <span className="muted small-text">{selectedCount} of {allIds.length} categories selected</span>
        </div>
        <div className="catalog-picker-actions">
          <button className="button button-secondary button-compact" type="button" onClick={() => setSelected(new Set(allIds))}>Select all</button>
          <button className="button button-secondary button-compact" type="button" onClick={() => setSelected(new Set())}>Clear all</button>
          <button className="button button-secondary button-compact" type="button" onClick={() => setOpen(new Set(allBranches))}>Expand all</button>
          <button className="button button-secondary button-compact" type="button" onClick={() => setOpen(new Set(initialOpen))}>Collapse</button>
        </div>
      </div>

      <div className="field catalog-picker-search">
        <label htmlFor={searchId}>Find a category</label>
        <input id={searchId} type="search" value={query} placeholder="Search category name, path or ID" onChange={(event) => setQuery(event.target.value)} />
      </div>

      <div className="catalog-category-tree">
        {tree.map((node) => renderNode(node))}
        {search && !tree.some((node) => matches(node, search)) ? <p className="muted catalog-picker-empty">No categories match “{query}”.</p> : null}
      </div>
    </div>
  );
}
