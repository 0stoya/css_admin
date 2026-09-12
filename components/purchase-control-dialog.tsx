"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import styles from "./purchase-control-modals.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  children: ReactNode;
  busy?: boolean;
  wide?: boolean;
  closeOnBackdrop?: boolean;
  initialFocus?: "heading" | "input";
};

/** Native top-layer dialog: background inertness and keyboard containment stay with the browser. */
export function PurchaseControlDialog({
  open, onClose, title, description, children, busy = false, wide = false,
  closeOnBackdrop = true, initialFocus = "heading",
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const backdropPress = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    if (!dialog.open) dialog.showModal();
    document.body.style.overflow = "hidden";
    const focusTarget = initialFocus === "input"
      ? dialog.querySelector<HTMLElement>('input[name="name"]')
      : dialog.querySelector<HTMLElement>("h2");
    focusTarget?.focus();
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus();
    };
  }, [open, initialFocus]);

  function isBackdrop(target: EventTarget | null, x: number, y: number) {
    const dialog = dialogRef.current;
    if (!dialog || target !== dialog) return false;
    const bounds = dialog.getBoundingClientRect();
    return x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom;
  }

  return (
    <dialog
      ref={dialogRef}
      className={`${styles.dialog} ${wide ? styles.wide : ""}`}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={busy || undefined}
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      onPointerDown={(event) => { backdropPress.current = isBackdrop(event.target, event.clientX, event.clientY); }}
      onClick={(event) => {
        if (!busy && closeOnBackdrop && backdropPress.current && isBackdrop(event.target, event.clientX, event.clientY)) onClose();
        backdropPress.current = false;
      }}
    >
      <header className={styles.header}>
        <div>
          <h2 id={titleId} tabIndex={-1}>{title}</h2>
          <p id={descriptionId}>{description}</p>
        </div>
        <button className={styles.iconButton} type="button" onClick={onClose} disabled={busy} aria-label={`Close ${title}`}>
          <X size={20} aria-hidden="true" />
        </button>
      </header>
      {children}
    </dialog>
  );
}
