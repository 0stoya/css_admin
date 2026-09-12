import { CalendarDays, ClipboardList, History, RotateCcw, Users } from "lucide-react";
import { PurchaseControlHelp } from "./purchase-control-help";
import styles from "./purchase-control-modals.module.css";

/** Shared help content; permission and allowance decisions remain with Magento. */
export function PurchaseControlGuidance({ iconOnly = false }: { iconOnly?: boolean }) {
  return (
    <PurchaseControlHelp iconOnly={iconOnly}>
      <div className={styles.intro}>
        <Users size={21} aria-hidden="true" />
        <p>Allowances belong to the <strong>company user placing the order</strong>, not to each beneficiary Employee. Magento decides whether approval is needed; zero remaining does not mean an unconditional purchasing ban.</p>
      </div>
      <section className={styles.guideSection}>
        <h3><ClipboardList size={19} aria-hidden="true" /> From template to allowance</h3>
        <div className={styles.steps}>
          <article><span className={styles.stepNumber}>1</span><div><h4>Save the rules</h4><p>Changes the template definition only. Existing buyer allowances and counters are unchanged.</p></div></article>
          <article><span className={styles.stepNumber}>2</span><div><h4>Assign a role</h4><p>Links the template to a company role. Assignment alone, or unassignment, does not clear existing allowances.</p></div></article>
          <article><span className={styles.stepNumber}>3</span><div><h4>Apply when ready</h4><p>Replaces allowances and restarts counters for eligible users with the Template approval setting, across <strong>every role assigned to that template</strong>.</p></div></article>
        </div>
      </section>
      <div className={styles.guideGrid}>
        <section className={styles.guideCard}>
          <h3><CalendarDays size={19} aria-hidden="true" /> Time windows</h3>
          <p>Each product currently has one quantity limit and one duration. For example, 10 items in a 365-day allowance period.</p>
          <p>Magento handles scheduled renewal. The template start date may differ from a buyer’s current applied period. Future and expired allowances show zero usable remaining quantity.</p>
        </section>
        <section className={styles.guideCard}>
          <h3><RotateCcw size={19} aria-hidden="true" /> Reset counters</h3>
          <p>Clears eligible buyers’ usage without changing start dates. It does not activate a future or expired allowance. Review the affected-user result after applying or resetting.</p>
        </section>
      </div>
      <section className={styles.guideSection}>
        <h3><History size={19} aria-hidden="true" /> History stays with the purchase</h3>
        <p>History is retained after reapplication and resets. Refunds adjust their original period. Refunds against imported legacy purchases do not automatically replenish today’s balance and may need reviewed reconciliation.</p>
      </section>
      <aside className={styles.note}>
        <strong>More than one limit for the same product?</strong>
        <p>Stacked limits such as “10 in 365 days and 2 in 30 days” are not supported yet. Adding the same SKU again or assigning another template does not combine limits.</p>
      </aside>
    </PurchaseControlHelp>
  );
}
