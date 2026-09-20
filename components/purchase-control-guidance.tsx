import { CalendarDays, ClipboardList, History, RotateCcw, Users } from "lucide-react";
import { PurchaseControlHelp } from "./purchase-control-help";
import styles from "./purchase-control-modals.module.css";

/** Shared help content; permission and allowance decisions remain with Magento. */
export function PurchaseControlGuidance({ iconOnly = false }: { iconOnly?: boolean }) {
  return (
    <PurchaseControlHelp iconOnly={iconOnly}>
      <div className={styles.intro}>
        <Users size={21} aria-hidden="true" />
        <p>Fluid can enforce purchase controls for the <strong>company user placing the order</strong> and, where configured, for the canonical beneficiary <strong>Employee</strong> on the basket line. Employees remain non-login beneficiary identities.</p>
      </div>
      <section className={styles.guideSection}>
        <h3><ClipboardList size={19} aria-hidden="true" /> From template to allowance</h3>
        <div className={styles.steps}>
          <article><span className={styles.stepNumber}>1</span><div><h4>Save the rules</h4><p>Changes the template definition only. Existing applied buyer or Employee allowances are unchanged.</p></div></article>
          <article><span className={styles.stepNumber}>2</span><div><h4>Assign the template</h4><p>Roles govern eligible buyers and can also act as an Employee <strong>Purchase Role</strong>. Purchase Role is policy inheritance only: it does not create a login or grant role permissions. Assignment changes do not clear applied allowances.</p></div></article>
          <article><span className={styles.stepNumber}>3</span><div><h4>Apply when ready</h4><p>Materialises the current template. Role Apply covers eligible buyers plus Employees inheriting that Purchase Role. A direct Employee override takes precedence and is left alone by role Apply.</p></div></article>
        </div>
      </section>
      <div className={styles.guideGrid}>
        <section className={styles.guideCard}>
          <h3><CalendarDays size={19} aria-hidden="true" /> Main + rolling limits</h3>
          <p>Every product has a main quantity and period, such as 200 items in 365 days. A product may also have one tighter rolling cap, such as no more than 5 items in any trailing 7 days.</p>
          <p>Fluid calculates rolling usage from durable purchase history; it is not a weekly calendar reset. For buyers, exceeding either limit follows the existing approval path. Applied Employee limits are beneficiary hard constraints and cannot be overridden by approving the purchasing user.</p>
        </section>
        <section className={styles.guideCard}>
          <h3><RotateCcw size={19} aria-hidden="true" /> Reset counters</h3>
          <p>Reset restarts main-period consumption without erasing purchase history. Rolling-cap usage therefore does <strong>not</strong> reset: purchases stay in the rolling window until they age out or are returned/cancelled.</p>
        </section>
      </div>
      <section className={styles.guideSection}>
        <h3><History size={19} aria-hidden="true" /> History stays with the purchase</h3>
        <p>History is retained after reapplication and resets. Refunds and cancellations adjust the original period and rolling usage. Imported legacy buyer purchases keep the existing conservative reconciliation policy.</p>
      </section>
      <aside className={styles.note}>
        <strong>Employee inheritance</strong>
        <p>Employee policy resolves direct override first, then Purchase Role inheritance. Removing an override reveals the role template but does not rewrite currently applied allowances until Apply is used.</p>
      </aside>
      <aside className={styles.note}>
        <strong>One SKU rule, two tiers</strong>
        <p>Do not add the same SKU twice to represent the second limit. Configure the optional Short-term max and Rolling days on the same product rule.</p>
      </aside>
    </PurchaseControlHelp>
  );
}
