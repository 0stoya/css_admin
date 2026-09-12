/** Shared guidance for the Magento-staff screen and company-user portal. */
export function PurchaseControlGuidance() {
  return (
    <details className="card">
      <summary><strong>How quantity allowances work</strong></summary>
      <div className="stack">
        <p>These are product allowances for the company user placing the order, not separate budgets for beneficiary Employees. Magento decides whether a basket needs approval; a zero remaining allowance is not an unconditional purchasing ban.</p>
        <p><strong>Save</strong> changes a template’s definition only. <strong>Assign</strong> links it to a role. <strong>Apply</strong> replaces allowances and restarts counters for eligible users whose approval setting is Template, across every role assigned to that template. Assignment alone, or unassignment, does not clear existing allowances.</p>
        <p><strong>Reset counters</strong> clears eligible users’ usage without changing their start dates. It does not activate a future or expired allowance. Scheduled renewal is handled by Magento, not this screen.</p>
        <p><strong>Allowances</strong> shows Magento’s usable remaining quantity for the recorded start date and duration. Future and expired allowances return zero. Do not interpret the start date of the template as the current period of every buyer.</p>
        <p><strong>History</strong> is retained after reapplication and resets. Refunds adjust their original period; refunds against imported legacy purchases do not automatically replenish today’s balance and may need reviewed reconciliation.</p>
      </div>
    </details>
  );
}
