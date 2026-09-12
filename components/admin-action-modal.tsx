"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Eye, Pencil, Plus, ShieldCheck } from "lucide-react";
import { PurchaseControlDialog } from "./purchase-control-dialog";
import styles from "./admin-action-modal.module.css";

type TriggerIcon = "plus" | "edit" | "view" | "permissions";
type TriggerVariant = "primary" | "secondary" | "row";

type AdminActionModalProps = {
  title: string;
  description: string;
  triggerLabel: string;
  triggerIcon?: TriggerIcon;
  triggerVariant?: TriggerVariant;
  defaultOpen?: boolean;
  stateKey?: string;
  wide?: boolean;
  children: ReactNode;
};

const ModalContext = createContext<{ close: () => void } | null>(null);

function TriggerGlyph({ icon }: { icon: TriggerIcon }) {
  const props = { size: 16, "aria-hidden": true } as const;
  if (icon === "plus") return <Plus {...props} />;
  if (icon === "view") return <Eye {...props} />;
  if (icon === "permissions") return <ShieldCheck {...props} />;
  return <Pencil {...props} />;
}

function useModalContext() {
  const context = useContext(ModalContext);
  if (!context) throw new Error("Admin modal controls must be rendered inside AdminActionModal.");
  return context;
}

export function AdminActionModal({
  title,
  description,
  triggerLabel,
  triggerIcon = "edit",
  triggerVariant = "row",
  defaultOpen = false,
  stateKey = "",
  wide = false,
  children,
}: AdminActionModalProps) {
  const [open, setOpen] = useState(defaultOpen);

  // Server actions redirect back with a new state key. Reset to the server-supplied
  // default so successful saves close, while validation/backend errors can reopen
  // the relevant modal through ?modal=....
  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen, stateKey]);

  const triggerClass = triggerVariant === "primary"
    ? `button ${styles.primaryTrigger}`
    : triggerVariant === "secondary"
      ? `button button-secondary ${styles.secondaryTrigger}`
      : styles.rowTrigger;

  return (
    <ModalContext.Provider value={{ close: () => setOpen(false) }}>
      <button
        type="button"
        className={triggerClass}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <TriggerGlyph icon={triggerIcon} />
        <span>{triggerLabel}</span>
      </button>
      <PurchaseControlDialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
        wide={wide}
        closeOnBackdrop={false}
      >
        <div className={styles.body}>{children}</div>
      </PurchaseControlDialog>
    </ModalContext.Provider>
  );
}

export function AdminFormFooter({
  submitLabel,
  pendingLabel,
  hint,
  disabled = false,
  danger = false,
}: {
  submitLabel: string;
  pendingLabel?: string;
  hint?: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  const { close } = useModalContext();
  const { pending } = useFormStatus();

  return (
    <div className={styles.footer}>
      {hint ? <span className={styles.footerHint}>{hint}</span> : <span className={styles.footerSpacer} />}
      <button className="button button-secondary" type="button" onClick={close} disabled={pending}>Cancel</button>
      <button className={`button ${danger ? "button-danger" : ""}`} type="submit" disabled={pending || disabled}>
        {pending ? (pendingLabel ?? "Saving…") : submitLabel}
      </button>
    </div>
  );
}

export function AdminCloseFooter({ label = "Close" }: { label?: string }) {
  const { close } = useModalContext();
  return (
    <div className={styles.footer}>
      <span className={styles.footerSpacer} />
      <button className="button" type="button" onClick={close}>{label}</button>
    </div>
  );
}
