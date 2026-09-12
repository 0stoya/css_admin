/** Presentation/input helpers only. Magento owns scope, eligibility and accounting. */
export type PurchaseRuleInput = {
  sku: string;
  quantity_limit: number;
  duration_days: number;
  start_date: string;
};

const MAX_GRAPHQL_INT = 2_147_483_647;

export function requiredId(formData: FormData, key: string): number {
  const raw = String(formData.get(key) ?? "").trim();
  const value = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isInteger(value) || value < 1 || value > MAX_GRAPHQL_INT) {
    throw new Error(`${key} must be a positive GraphQL integer.`);
  }
  return value;
}

export function optionalId(formData: FormData, key: string): number | null {
  return String(formData.get(key) ?? "").trim() === "" ? null : requiredId(formData, key);
}

export function checkboxChecked(formData: FormData, key: string): boolean {
  return ["on", "yes", "true", "1"].includes(String(formData.get(key) ?? ""));
}

export function parsePurchaseRules(raw: string): PurchaseRuleInput[] {
  const seen = new Set<string>();
  return raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const [sku, quantityRaw, durationRaw, startDate, ...extra] = line.split("|").map((value) => value.trim());
    if (extra.length || !sku || !quantityRaw || !durationRaw || !startDate) {
      throw new Error(`Rule ${index + 1} must use: SKU | quantity limit | duration days | YYYY-MM-DD.`);
    }
    const quantity = Number(quantityRaw);
    const duration = Number(durationRaw);
    if (!/^\d+$/.test(quantityRaw) || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_GRAPHQL_INT) {
      throw new Error(`Rule ${index + 1} quantity must be a positive GraphQL integer.`);
    }
    if (!/^\d+$/.test(durationRaw) || !Number.isInteger(duration) || duration < 1 || duration > MAX_GRAPHQL_INT) {
      throw new Error(`Rule ${index + 1} duration must be a positive GraphQL integer.`);
    }
    const date = new Date(`${startDate}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== startDate) {
      throw new Error(`Rule ${index + 1} start date must be a real date in YYYY-MM-DD format.`);
    }
    const key = sku.toLowerCase();
    if (seen.has(key)) throw new Error(`Rule ${index + 1} repeats SKU ${sku}. Keep one rule per SKU.`);
    seen.add(key);
    return { sku, quantity_limit: quantity, duration_days: duration, start_date: startDate };
  });
}

export function templateInput(formData: FormData) {
  const templateId = optionalId(formData, "templateId");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Enter a template name.");
  return {
    ...(templateId === null ? {} : { template_id: templateId }),
    name,
    rules: parsePurchaseRules(String(formData.get("rules") ?? "")),
  };
}

export function requireAcknowledgement(formData: FormData, key: "confirmApply" | "confirmReset") {
  if (formData.get(key) !== "yes") {
    throw new Error(key === "confirmApply"
      ? "Confirm that applying the template will replace eligible buyers' allowances and restart their counters."
      : "Confirm that resetting counters will clear eligible buyers' recorded usage.");
  }
}

/** Counts come from the mutation result, never from a locally inferred user list. */
export function affectedUsersNotice(action: "applied" | "reset", count: number): string {
  if (!Number.isInteger(count) || count < 0) {
    return "The request completed, but Magento did not return a usable affected-user count. Review allowances before retrying.";
  }
  if (count === 0) {
    return "No eligible buyers were changed. Check the template's role assignments and users' template approval setting.";
  }
  return action === "applied"
    ? `Template applied to ${count} eligible buyer${count === 1 ? "" : "s"}. Their allowance counters restarted; purchase history was retained.`
    : `Usage counters reset for ${count} eligible buyer${count === 1 ? "" : "s"}. Allowance dates were not changed; purchase history was retained.`;
}

export function assignmentNotice(templateId: number | null, applyToUsers: boolean, count: number): string {
  if (templateId === null) return "Template unassigned from the role. Existing applied allowances were not removed.";
  if (!applyToUsers) return "Template assigned to the role. Existing applied allowances were not changed; use Apply when ready.";
  return `Template assigned. ${affectedUsersNotice("applied", count)} Application covers eligible buyers across all roles assigned to this template.`;
}
