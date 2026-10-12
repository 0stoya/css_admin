// Pure sidebar routing rules: exact query-driven tools keep their existing
// selection semantics, while explicit CRM links may match nested detail pages.
export function sectionChildIsActive(
  pathname: string,
  currentQuery: string,
  href: string,
  matchDescendants = false,
): boolean {
  const [withoutHash] = href.split("#", 1);
  const [path, query = ""] = withoutHash.split("?", 2);

  if (pathname !== path) {
    return matchDescendants && !query && pathname.startsWith(`${path}/`);
  }

  const current = new URLSearchParams(currentQuery);
  const expected = new URLSearchParams(query);
  if (![...expected.keys()].length) {
    return !current.get("view");
  }

  for (const [key, value] of expected.entries()) {
    if (current.get(key) !== value) return false;
  }
  return true;
}
