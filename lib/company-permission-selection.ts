/**
 * Permission selection is independent of the visible tree. A native form cannot
 * collect checkboxes that were unmounted by collapse/search, and Fluid treats
 * allowed_resources as a full replacement, not a patch.
 */
export function permissionIdsForForm(
  resources: readonly { resource_id: string }[],
  selected: ReadonlySet<string>,
): string[] {
  const ids = new Set<string>();
  for (const resource of resources) {
    // Keep selected protected IDs (e.g. the Fluid root), but never submit
    // obsolete IDs that no longer exist in the current backend ACL tree.
    if (selected.has(resource.resource_id)) ids.add(resource.resource_id);
  }
  return [...ids];
}

export function applyPermissionSelection(
  current: ReadonlySet<string>,
  resourceIds: readonly string[],
  checked: boolean,
): Set<string> {
  const next = new Set(current);
  for (const id of resourceIds) {
    if (checked) next.add(id);
    else next.delete(id);
  }
  return next;
}
