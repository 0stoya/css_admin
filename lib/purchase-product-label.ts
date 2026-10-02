export function productNameWithoutLeadingSku(
  sku: string,
  productName: string | null | undefined,
) {
  const name = productName?.trim() ?? "";
  const cleanSku = sku.trim();
  if (!name || !cleanSku) return name;

  const escapedSku = cleanSku.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const withoutSku = name
    .replace(new RegExp(`^${escapedSku}(?:\\s*[-–—:]\\s*|\\s+)`, "i"), "")
    .trim();

  return withoutSku || name;
}

export function purchaseProductLabel(
  sku: string,
  productName: string | null | undefined,
) {
  const cleanSku = sku.trim();
  const cleanName = productNameWithoutLeadingSku(cleanSku, productName);
  if (!cleanSku) return cleanName || "Product";
  return cleanName ? `${cleanSku} — ${cleanName}` : cleanSku;
}
