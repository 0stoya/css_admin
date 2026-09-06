"use client";

import { useMemo, useState } from "react";

export type PurchaseRuleEditorValue = {
  sku: string;
  quantity_limit: number;
  duration_days: number;
  start_date: string;
};

type DraftRule = {
  key: number;
  sku: string;
  quantity: string;
  duration: string;
  startDate: string;
};

function toDraft(rule: PurchaseRuleEditorValue, key: number): DraftRule {
  return {
    key,
    sku: rule.sku,
    quantity: String(rule.quantity_limit),
    duration: String(rule.duration_days),
    startDate: rule.start_date,
  };
}

function serialize(rows: DraftRule[]) {
  return rows
    .map((row) => `${row.sku.trim()} | ${row.quantity.trim()} | ${row.duration.trim()} | ${row.startDate.trim()}`)
    .join("\n");
}

export function PurchaseRuleEditor({
  initialRules = [],
  label = "Rules",
}: {
  initialRules?: PurchaseRuleEditorValue[];
  label?: string;
}) {
  const [nextKey, setNextKey] = useState(initialRules.length + 1);
  const [rows, setRows] = useState<DraftRule[]>(() => initialRules.map((rule, index) => toDraft(rule, index + 1)));
  const serialized = useMemo(() => serialize(rows), [rows]);

  function updateRow(key: number, field: keyof Omit<DraftRule, "key">, value: string) {
    setRows((current) => current.map((row) => row.key === key ? { ...row, [field]: value } : row));
  }

  function addRule() {
    const key = nextKey;
    setNextKey((current) => current + 1);
    setRows((current) => [
      ...current,
      { key, sku: "", quantity: "1", duration: "30", startDate: "" },
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
          <span className="muted small-text">{rows.length} rule{rows.length === 1 ? "" : "s"}</span>
        </div>
        <button className="button button-secondary button-compact" type="button" onClick={addRule}>+ Add rule</button>
      </div>

      {rows.length ? (
        <div className="purchase-rule-grid" role="group" aria-label={label}>
          <div className="purchase-rule-head" aria-hidden="true">
            <span>SKU</span><span>Quantity limit</span><span>Duration</span><span>Start date</span><span />
          </div>
          {rows.map((row, index) => (
            <div className="purchase-rule-row" key={row.key}>
              <div className="field purchase-rule-field">
                <label htmlFor={`rule-${row.key}-sku`}>SKU <span className="mobile-only">rule {index + 1}</span></label>
                <input
                  id={`rule-${row.key}-sku`}
                  value={row.sku}
                  required
                  placeholder="Product SKU"
                  onChange={(event) => updateRow(row.key, "sku", event.target.value)}
                />
              </div>
              <div className="field purchase-rule-field">
                <label htmlFor={`rule-${row.key}-quantity`}>Quantity limit</label>
                <input
                  id={`rule-${row.key}-quantity`}
                  type="number"
                  min="1"
                  step="1"
                  value={row.quantity}
                  required
                  onChange={(event) => updateRow(row.key, "quantity", event.target.value)}
                />
              </div>
              <div className="field purchase-rule-field">
                <label htmlFor={`rule-${row.key}-duration`}>Duration days</label>
                <input
                  id={`rule-${row.key}-duration`}
                  type="number"
                  min="1"
                  step="1"
                  value={row.duration}
                  required
                  onChange={(event) => updateRow(row.key, "duration", event.target.value)}
                />
              </div>
              <div className="field purchase-rule-field">
                <label htmlFor={`rule-${row.key}-date`}>Start date</label>
                <input
                  id={`rule-${row.key}-date`}
                  type="date"
                  value={row.startDate}
                  required
                  onChange={(event) => updateRow(row.key, "startDate", event.target.value)}
                />
              </div>
              <button className="purchase-rule-remove" type="button" aria-label={`Remove rule ${index + 1}`} onClick={() => removeRule(row.key)}>Remove</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state compact-empty-state">
          <strong>No rules yet</strong>
          <span className="muted small-text">Add a rule when this template should limit a product.</span>
        </div>
      )}

      <p className="muted small-text">Fluid still validates every SKU, quantity, duration and date when the template is saved.</p>
    </div>
  );
}
