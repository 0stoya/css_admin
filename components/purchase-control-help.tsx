"use client";

import { useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { PurchaseControlDialog } from "./purchase-control-dialog";
import styles from "./purchase-control-modals.module.css";

export function PurchaseControlHelp({ children, iconOnly = false }: { children: ReactNode; iconOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.helpSlot}>
      <button
        type="button"
        className={iconOnly ? styles.infoButton : styles.helpButton}
        aria-label="How quantity allowances work"
        title="How quantity allowances work"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Info size={19} aria-hidden="true" />
        {!iconOnly ? <span>How quantity allowances work</span> : null}
      </button>
      <PurchaseControlDialog
        open={open}
        onClose={() => setOpen(false)}
        title="How quantity allowances work"
        description="A quick guide to templates, buyer allowances and purchase history."
      >
        <div className={styles.body}>{children}</div>
        <footer className={styles.footer}>
          <button className="button" type="button" onClick={() => setOpen(false)}>Got it</button>
        </footer>
      </PurchaseControlDialog>
    </div>
  );
}
