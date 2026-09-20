/** Presentation/input helpers only. Magento owns scope, eligibility and accounting. */
export type PurchaseRuleInput = {
  sku: string;
  quantity_limit: number;
  duration_days: number;
  start_date: string;
  short_term_quantity_limit?: number;
  short_term_duration_days?: number;
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

function positiveRuleInteger(raw: string, index: number, label: string): number {
  const value = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isInteger(value) || value < 1 || value > MAX_GRAPHQL_INT) {
    throw new Error(`Rule ${index + 1} ${label} must be a positive GraphQL integer.`);
  }
  return value;
}

export function parsePurchaseRules(raw: string): PurchaseRuleInput[] {
  const seen = new Set<string>();
  return raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const [
      sku,
      quantityRaw,
      durationRaw,
      startDate,
      shortQuantityRaw = "",
      shortDurationRaw = "",
      ...extra
    ] = line.split("|").map((value) => value.trim());

    if (extra.length || !sku || !quantityRaw || !durationRaw || !startDate) {
      throw new Error(
        `Rule ${index + 1} must use: SKU | quantity limit | duration days | YYYY-MM-DD | optional short-term max | optional rolling days.`,
      );
    }

    const quantity = positiveRuleInteger(quantityRaw, index, "quantity");
    const duration = positiveRuleInteger(durationRaw, index, "duration");
    const date = new Date(`${startDate}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== startDate) {
      throw new Error(`Rule ${index + 1} start date must be a real date in YYYY-MM-DD format.`);
    }

    const shortQuantitySupplied = shortQuantityRaw !== "";
    const shortDurationSupplied = shortDurationRaw !== "";
    if (shortQuantitySupplied !== shortDurationSupplied) {
      throw new Error(`Rule ${index + 1} short-term max and rolling days must both be supplied or both left blank.`);
    }

    let tier: Pick<PurchaseRuleInput, "short_term_quantity_limit" | "short_term_duration_days"> | undefined;
    if (shortQuantitySupplied) {
      const shortQuantity = positiveRuleInteger(shortQuantityRaw, index, "short-term max");
      const shortDuration = positiveRuleInteger(shortDurationRaw, index, "rolling duration");
      if (shortDuration >= duration) {
        throw new Error(`Rule ${index + 1} rolling duration must be shorter than the main duration.`);
      }
      tier = {
        short_term_quantity_limit: shortQuantity,
        short_term_duration_days: shortDuration,
      };
    }

    const key = sku.toLowerCase();
    if (seen.has(key)) throw new Error(`Rule ${index + 1} repeats SKU ${sku}. Keep one rule per SKU.`);
    seen.add(key);

    return {
      sku,
      quantity_limit: quantity,
      duration_days: duration,
      start_date: startDate,
      ...(tier ?? {}),
    };
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
export function affectedUsersNotice(
  action: "applied" | "reset",
  buyerCount: number,
  employeeCount = 0,
): string {
  if (
    !Number.isInteger(buyerCount) || buyerCount < 0
    || !Number.isInteger(employeeCount) || employeeCount < 0
  ) {
    return "The request completed, but Magento did not return usable affected-subject counts. Review allowances before retrying.";
  }
  if (buyerCount === 0 && employeeCount === 0) {
    return "No eligible buyers or Employees were changed. Check the template's role assignments and applied policy.";
  }

  const buyers = `${buyerCount} eligible buyer${buyerCount === 1 ? "" : "s"}`;
  const employees = `${employeeCount} Employee${employeeCount === 1 ? "" : "s"}`;

  return action === "applied"
    ? `Template applied to ${buyers} and ${employees}. Main allowance periods restarted; purchase history was retained.`
    : `Usage counters reset for ${buyers} and ${employees}. Purchase history was retained; rolling usage is still history-based.`;
}

export function assignmentNotice(
  templateId: number | null,
  applyToUsers: boolean,
  buyerCount: number,
  employeeCount = 0,
): string {
  if (templateId === null) return "Template unassigned from the role. Existing applied allowances were not removed.";
  if (!applyToUsers) return "Template assigned to the role. Missing products are added automatically for Employees using this Purchase Role. Existing buyer allowances and existing Employee SKU limits are not changed; use Apply when you want those existing limits refreshed.";
  return `Template assigned. ${affectedUsersNotice("applied", buyerCount, employeeCount)} Application covers eligible buyers and inheriting Employees across all roles assigned to this template.`;
}
