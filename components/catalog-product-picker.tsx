"use client";

import { useId, useMemo, useState } from "react";

export type CatalogProductPickerItem = {
  id: number;
  sku: string;
  name: string;
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("en");
}

export function CatalogProductPicker({
  products,
  selectedProductIds = [],
  preselectAll = false,
  fieldName = "allowedProductIds",
  label = "Products",
}: {
  products: CatalogProductPickerItem[];
  selectedProductIds?: number[];
  preselectAll?: boolean;
  fieldName?: string;
  label?: string;
}) {
  const searchId = useId();
  const allIds = useMemo(() => products.map((product) => product.id), [products]);
  const [selected, setSelected] = useState(() => new Set(preselectAll ? allIds : selectedProductIds));
  const [query, setQuery] = useState("");
  const normalizedQuery = normalize(query);
  const filtered = products.filter((product) => {
    if (!normalizedQuery) return true;
    return normalize(`${product.name} ${product.sku} ${product.id}`).includes(normalizedQuery);
  });

  function setVisible(checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      filtered.forEach((product) => {
        if (checked) next.add(product.id);
        else next.delete(product.id);
      });
      return next;
    });
  }

  function toggleProduct(id: number, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const selectedCount = products.reduce((count, product) => count + (selected.has(product.id) ? 1 : 0), 0);

  return (
    <div className="catalog-picker">
      <div className="catalog-picker-toolbar">
        <div>
          <strong>{label}</strong>
          <span className="muted small-text">{selectedCount} of {products.length} products selected</span>
        </div>
        <div className="catalog-picker-actions">
          <button className="button button-secondary button-compact" type="button" onClick={() => setVisible(true)}>Select visible</button>
          <button className="button button-secondary button-compact" type="button" onClick={() => setVisible(false)}>Clear visible</button>
        </div>
      </div>

      <div className="field catalog-picker-search">
        <label htmlFor={searchId}>Find a product</label>
        <input id={searchId} type="search" value={query} placeholder="Search SKU or product name" onChange={(event) => setQuery(event.target.value)} />
      </div>

      <div className="catalog-product-list">
        {filtered.map((product) => (
          <label className="catalog-product-option" key={product.id}>
            <input
              name={fieldName}
              type="checkbox"
              value={product.id}
              checked={selected.has(product.id)}
              onChange={(event) => toggleProduct(product.id, event.target.checked)}
            />
            <span className="catalog-product-copy">
              <strong>{product.name}</strong>
              <small><code>{product.sku}</code> · Product #{product.id}</small>
            </span>
          </label>
        ))}
        {!filtered.length ? <p className="muted catalog-picker-empty">No products match “{query}”.</p> : null}
      </div>
    </div>
  );
}
