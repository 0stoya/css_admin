"use client";

import { useEffect, useMemo, useState } from "react";

export type PurchaseProductPickerItem = {
  product_id: number;
  sku: string;
  name: string;
};

type SearchResult = {
  total_count: number;
  items: PurchaseProductPickerItem[];
  page_info: {
    page_size: number;
    current_page: number;
    total_pages: number;
  };
};

export function PurchaseProductPicker({
  companyId,
  excludedSkus,
  onAdd,
}: {
  companyId: number;
  excludedSkus: string[];
  onAdd: (products: PurchaseProductPickerItem[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const excluded = useMemo(
    () => new Set(excludedSkus.map((sku) => sku.trim().toLocaleLowerCase("en"))),
    [excludedSkus],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: "1", pageSize: "50" });
        if (query.trim()) params.set("search", query.trim());
        const response = await fetch(
          `/api/companies/${companyId}/purchase-control-products?${params.toString()}`,
          { cache: "no-store", signal: controller.signal },
        );
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error || "Product search failed.");
        setResult(body as SearchResult);
      } catch (caught) {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : "Product search failed.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [companyId, query]);

  useEffect(() => {
    setSelected((current) => {
      const next = new Set(
        Array.from(current).filter((id) => {
          const product = result?.items.find((item) => item.product_id === id);
          return product && !excluded.has(product.sku.toLocaleLowerCase("en"));
        }),
      );
      return next;
    });
  }, [excluded, result]);

  const availableItems = (result?.items ?? []).filter(
    (product) => !excluded.has(product.sku.toLocaleLowerCase("en")),
  );

  function toggle(productId: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  function addSelected() {
    const products = availableItems.filter((product) => selected.has(product.product_id));
    if (!products.length) return;
    onAdd(products);
    setSelected(new Set());
  }

  return (
    <div className="purchase-product-picker">
      <div className="purchase-product-picker-toolbar">
        <div>
          <strong>Choose products</strong>
          <small className="muted">
            {result ? `${result.total_count} products in the company catalogue` : "Search the company catalogue"}
          </small>
        </div>
        <button className="button button-compact" type="button" disabled={!selected.size} onClick={addSelected}>
          Add selected{selected.size ? ` (${selected.size})` : ""}
        </button>
      </div>

      <div className="field purchase-product-search">
        <label htmlFor="purchase-product-search">Find a product</label>
        <input
          id="purchase-product-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search SKU or product name"
          autoComplete="off"
        />
      </div>

      {error ? <div className="error">{error}</div> : null}
      {loading && !result ? <div className="purchase-product-picker-state">Loading products…</div> : null}

      {result ? (
        <div className="purchase-product-options" aria-busy={loading}>
          {availableItems.length ? availableItems.map((product) => (
            <label className="purchase-product-option" key={product.product_id}>
              <input
                type="checkbox"
                checked={selected.has(product.product_id)}
                onChange={() => toggle(product.product_id)}
              />
              <span>
                <strong>{product.name}</strong>
                <small><code>{product.sku}</code> · Product #{product.product_id}</small>
              </span>
            </label>
          )) : (
            <div className="purchase-product-picker-state">
              {result.items.length ? "All matching products are already in this template." : "No company-catalogue products match this search."}
            </div>
          )}
        </div>
      ) : null}

      {result && result.page_info.total_pages > 1 ? (
        <p className="purchase-pagination-note">
          Showing the first {result.page_info.page_size} matches. Refine the search by SKU or product name to find more.
        </p>
      ) : null}
    </div>
  );
}
