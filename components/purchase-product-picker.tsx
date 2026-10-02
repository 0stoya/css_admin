"use client";

import { useEffect, useMemo, useState } from "react";
import {
  searchPortalPurchaseControlProducts,
  searchPurchaseControlProducts,
} from "@/lib/actions/purchase-control-product-search";

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
  searchMode = "admin",
}: {
  companyId: number;
  excludedSkus: string[];
  onAdd: (products: PurchaseProductPickerItem[]) => void;
  searchMode?: "admin" | "portal";
}) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Map<number, PurchaseProductPickerItem>>(
    () => new Map(),
  );
  const excluded = useMemo(
    () => new Set(excludedSkus.map((sku) => sku.trim().toLocaleLowerCase("en"))),
    [excludedSkus],
  );

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const response = searchMode === "portal"
          ? await searchPortalPurchaseControlProducts(query.trim())
          : await searchPurchaseControlProducts(companyId, query.trim());
        if (!active) return;

        if (!response.ok) {
          setError(response.error);
          return;
        }

        setResult(response.result);
      } catch (caught) {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : "Product search failed.");
      } finally {
        if (active) setLoading(false);
      }
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [companyId, query, searchMode]);

  const visibleItems = result?.items ?? [];
  const selectableItems = visibleItems.filter(
    (product) => !excluded.has(product.sku.toLocaleLowerCase("en")),
  );
  const selectedCount = Array.from(selected.values()).filter(
    (product) => !excluded.has(product.sku.toLocaleLowerCase("en")),
  ).length;

  function toggle(product: PurchaseProductPickerItem) {
    if (excluded.has(product.sku.toLocaleLowerCase("en"))) return;

    setSelected((current) => {
      const next = new Map(current);
      if (next.has(product.product_id)) next.delete(product.product_id);
      else next.set(product.product_id, product);
      return next;
    });
  }

  function selectVisible() {
    setSelected((current) => {
      const next = new Map(current);
      selectableItems.forEach((product) => next.set(product.product_id, product));
      return next;
    });
  }

  function clearVisible() {
    setSelected((current) => {
      const next = new Map(current);
      selectableItems.forEach((product) => next.delete(product.product_id));
      return next;
    });
  }

  function addSelected() {
    const products = Array.from(selected.values()).filter(
      (product) => !excluded.has(product.sku.toLocaleLowerCase("en")),
    );
    if (!products.length) return;
    onAdd(products);
    setSelected(new Map());
  }

  return (
    <div className="purchase-product-picker">
      <div className="purchase-product-picker-toolbar">
        <div>
          <strong>Choose products</strong>
          <small className="muted">
            {result
              ? `${result.total_count} products in the company catalogue${selectedCount ? ` · ${selectedCount} selected` : ""}`
              : "Search the company catalogue"}
          </small>
        </div>
        <div className="purchase-product-picker-actions">
          <button
            className="button button-secondary button-compact"
            type="button"
            disabled={!selectableItems.length}
            onClick={selectVisible}
          >
            Select visible
          </button>
          <button
            className="button button-secondary button-compact"
            type="button"
            disabled={!selectableItems.some((product) => selected.has(product.product_id))}
            onClick={clearVisible}
          >
            Clear visible
          </button>
          <button className="button button-compact" type="button" disabled={!selectedCount} onClick={addSelected}>
            Add selected{selectedCount ? ` (${selectedCount})` : ""}
          </button>
        </div>
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
          {visibleItems.length ? visibleItems.map((product) => {
            const skuKey = product.sku.toLocaleLowerCase("en");
            const isExcluded = excluded.has(skuKey);
            const isSelected = selected.has(product.product_id);
            return (
              <label
                className={[
                  "purchase-product-option",
                  isSelected ? "is-selected" : "",
                  isExcluded ? "is-excluded" : "",
                ].filter(Boolean).join(" ")}
                key={product.product_id}
                aria-disabled={isExcluded || undefined}
              >
                <input
                  type="checkbox"
                  checked={isExcluded ? false : isSelected}
                  disabled={isExcluded}
                  onChange={() => toggle(product)}
                />
                <span className="purchase-product-option-copy">
                  <span className="purchase-product-option-title">
                    <strong>{product.name}</strong>
                    {isExcluded ? <span className="purchase-product-status">Already added</span> : null}
                  </span>
                  <small>
                    <code>{product.sku}</code>
                    {searchMode === "admin" ? <span>Product #{product.product_id}</span> : null}
                  </small>
                </span>
              </label>
            );
          }) : (
            <div className="purchase-product-picker-state">
              No company-catalogue products match this search.
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
