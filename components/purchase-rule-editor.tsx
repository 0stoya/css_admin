"use client";

import { useId, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  PurchaseProductPicker,
  type PurchaseProductPickerItem,
} from "@/components/purchase-product-picker";

export type PurchaseRuleEditorValue = {
  sku: string;
  quantity_limit: number;
  duration_days: number;
  start_date: string;
  short_term_quantity_limit?: number | null;
  short_term_duration_days?: number | null;
};

type DraftRule = {
  key: number;
  sku: string;
  quantity: string;
  duration: string;
  shortQuantity: string;
  shortDuration: string;
  startDate: string;
};

function toDraft(rule: PurchaseRuleEditorValue, key: number): DraftRule {
  return {
    key,
    sku: rule.sku,
    quantity: String(rule.quantity_limit),
    duration: String(rule.duration_days),
    shortQuantity: rule.short_term_quantity_limit == null ? "" : String(rule.short_term_quantity_limit),
    shortDuration: rule.short_term_duration_days == null ? "" : String(rule.short_term_duration_days),
    startDate: rule.start_date,
  };
}

function serialize(rows: DraftRule[]) {
  return rows
    .map(
      (row) =>
        [
          row.sku.trim(),
          row.quantity.trim(),
          row.duration.trim(),
          row.startDate.trim(),
          row.shortQuantity.trim(),
          row.shortDuration.trim(),
        ].join(" | "),
    )
    .join("\n");
}

function companyIdFromPath(pathname: string) {
  const match = pathname.match(/^\/companies\/(\d+)(?:\/|$)/);
  const value = match ? Number(match[1]) : 0;
  return Number.isInteger(value) && value > 0 ? value : null;
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" />
    </svg>
  );
}

export function PurchaseRuleEditor({
  companyId,
  initialRules = [],
  label = "Rules",
}: {
  companyId?: number;
  initialRules?: PurchaseRuleEditorValue[];
  label?: string;
}) {
  const pathname = usePathname();
  const resolvedCompanyId = companyId ?? companyIdFromPath(pathname);
  const editorId = useId().replaceAll(":", "");
  const [nextKey, setNextKey] = useState(initialRules.length + 1);
  const [rows, setRows] = useState<DraftRule[]>(() =>
    initialRules.map((rule, index) => toDraft(rule, index + 1)),
  );
  const [pickerOpen, setPickerOpen] = useState(Boolean(resolvedCompanyId) && initialRules.length === 0);
  const serialized = useMemo(() => serialize(rows), [rows]);

  function updateRow(
    key: number,
    field: keyof Omit<DraftRule, "key">,
    value: string,
  ) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );
  }

  function addProducts(products: PurchaseProductPickerItem[]) {
    if (!products.length) return;
    setRows((current) => {
      const existing = new Set(current.map((row) => row.sku.trim().toLocaleLowerCase("en")));
      let key = nextKey;
      const additions = products
        .filter((product) => !existing.has(product.sku.trim().toLocaleLowerCase("en")))
        .map((product) => ({
          key: key++,
          sku: product.sku,
          quantity: "1",
          duration: "30",
          shortQuantity: "",
          shortDuration: "",
          startDate: "",
        }));
      setNextKey(key);
      return [...current, ...additions];
    });
    setPickerOpen(false);
  }

  function addManualRule() {
    const key = nextKey;
    setNextKey((current) => current + 1);
    setRows((current) => [
      ...current,
      {
        key,
        sku: "",
        quantity: "1",
        duration: "30",
        shortQuantity: "",
        shortDuration: "",
        startDate: "",
      },
    ]);
  }

  function removeRule(key: number) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  return (
    <div className="purchase-rule-editor">
      <input type="hidden" name="rules" value={serialized} />

      <div className="purchase-rule-toolbar">
        <div>
          <strong>{label}</strong>
          <span className="muted small-text">
            {rows.length} rule{rows.length === 1 ? "" : "s"}
          </span>
        </div>
        {resolvedCompanyId ? (
          <button
            className="button button-secondary button-compact icon-button-label"
            type="button"
            aria-expanded={pickerOpen}
            onClick={() => setPickerOpen((current) => !current)}
          >
            <PlusIcon />
            {pickerOpen ? "Close product picker" : "Add products"}
          </button>
        ) : (
          <button
            className="button button-secondary button-compact icon-button-label"
            type="button"
            onClick={addManualRule}
          >
            <PlusIcon />
            Add rule
          </button>
        )}
      </div>

      {pickerOpen && resolvedCompanyId ? (
        <PurchaseProductPicker
          companyId={resolvedCompanyId}
          excludedSkus={rows.map((row) => row.sku)}
          onAdd={addProducts}
        />
      ) : null}

      {rows.length ? (
        <div className="purchase-rule-grid" role="group" aria-label={label}>
          <div className="purchase-rule-head" aria-hidden="true">
            <span>SKU</span>
            <span>Main limit</span>
            <span>Main period</span>
            <span>Short-term max</span>
            <span>Rolling days</span>
            <span>Start date</span>
            <span />
          </div>
          {rows.map((row, index) => {
            const prefix = `${editorId}-${row.key}`;
            const shortPairRequired = Boolean(row.shortQuantity || row.shortDuration);
            return (
              <div className="purchase-rule-row" key={row.key}>
                <div className="field purchase-rule-field">
                  <label htmlFor={`${prefix}-sku`}>
                    SKU <span className="purchase-mobile-only">rule {index + 1}</span>
                  </label>
                  <input
                    id={`${prefix}-sku`}
                    value={row.sku}
                    required
                    readOnly={Boolean(resolvedCompanyId)}
                    aria-readonly={resolvedCompanyId ? "true" : undefined}
                    placeholder="Product SKU"
                    title={resolvedCompanyId ? "Choose a different product by removing this row and adding another catalogue product." : undefined}
                    onChange={resolvedCompanyId ? undefined : (event) => updateRow(row.key, "sku", event.target.value)}
                  />
                </div>
                <div className="field purchase-rule-field">
                  <label htmlFor={`${prefix}-quantity`}>Main quantity limit</label>
                  <input
                    id={`${prefix}-quantity`}
                    type="number"
                    min="1"
                    step="1"
                    value={row.quantity}
                    required
                    onChange={(event) => updateRow(row.key, "quantity", event.target.value)}
                  />
                </div>
                <div className="field purchase-rule-field">
                  <label htmlFor={`${prefix}-duration`}>Main duration days</label>
                  <input
                    id={`${prefix}-duration`}
                    type="number"
                    min="1"
                    step="1"
                    value={row.duration}
                    required
                    onChange={(event) => updateRow(row.key, "duration", event.target.value)}
                  />
                </div>
                <div className="field purchase-rule-field">
                  <label htmlFor={`${prefix}-short-quantity`}>Short-term max</label>
                  <input
                    id={`${prefix}-short-quantity`}
                    type="number"
                    min="1"
                    step="1"
                    value={row.shortQuantity}
                    required={shortPairRequired}
                    placeholder="Optional"
                    onChange={(event) => updateRow(row.key, "shortQuantity", event.target.value)}
                  />
                </div>
                <div className="field purchase-rule-field">
                  <label htmlFor={`${prefix}-short-duration`}>Rolling window days</label>
                  <input
                    id={`${prefix}-short-duration`}
                    type="number"
                    min="1"
                    step="1"
                    value={row.shortDuration}
                    required={shortPairRequired}
                    placeholder="Optional"
                    onChange={(event) => updateRow(row.key, "shortDuration", event.target.value)}
                  />
                </div>
                <div className="field purchase-rule-field">
                  <label htmlFor={`${prefix}-date`}>Start date</label>
                  <input
                    id={`${prefix}-date`}
                    type="date"
                    value={row.startDate}
                    required
                    onChange={(event) => updateRow(row.key, "startDate", event.target.value)}
                  />
                </div>
                <button
                  className="purchase-rule-remove"
                  type="button"
                  aria-label={`Remove rule ${index + 1}`}
                  onClick={() => removeRule(row.key)}
                >
                  <TrashIcon />
                  <span className="purchase-rule-remove-label">Remove</span>
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="purchase-empty-inline">
          <strong>No product rules yet</strong>
          <span className="muted small-text">
            {resolvedCompanyId
              ? "Choose one or more products from this company's catalogue to add rule rows."
              : "Add a rule when this template should limit a specific SKU."}
          </span>
        </div>
      )}

      <p className="muted small-text">
        Main allowance fields are required. Short-term max and rolling days are optional but must be supplied together;
        Fluid enforces the rolling cap in addition to the main allowance.
      </p>
    </div>
  );
}
