"use client";

import { useId, useRef, type MouseEvent, type ReactNode } from "react";
import styles from "./portal-modal.module.css";

type PortalModalProps = {
  title: string;
  description?: string;
  triggerLabel: string;
  triggerHint?: string;
  variant?: "primary" | "row";
  triggerIcon?: "plus" | "edit" | "arrow";
  children: ReactNode;
};

function TriggerIcon({ icon }: { icon: "plus" | "edit" | "arrow" }) {
  if (icon === "edit") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    );
  }

  if (icon === "arrow") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m9 18 6-6-6-6" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function PortalModal({
  title,
  description,
  triggerLabel,
  triggerHint,
  variant = "primary",
  triggerIcon,
  children,
}: PortalModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  function openModal() {
    dialogRef.current?.showModal();
  }

  function closeModal() {
    dialogRef.current?.close();
  }

  function closeOnBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) closeModal();
  }

  const isRow = variant === "row";
  const icon = triggerIcon ?? (isRow ? "arrow" : "plus");

  return (
    <div className={`${styles.slot} ${isRow ? styles.rowSlot : styles.primarySlot}`}>
      <button
        className={`${styles.trigger} ${isRow ? styles.rowTrigger : styles.primaryTrigger}`}
        type="button"
        onClick={openModal}
        aria-haspopup="dialog"
      >
        {isRow ? (
          <span>{triggerLabel}</span>
        ) : (
          <span className={styles.triggerCopy}>
            <strong>{triggerLabel}</strong>
            {triggerHint ? <small>{triggerHint}</small> : null}
          </span>
        )}
        <TriggerIcon icon={icon} />
      </button>

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        onClick={closeOnBackdrop}
      >
        <div className={styles.panel}>
          <header className={styles.header}>
            <div>
              <h2 id={titleId}>{title}</h2>
              {description ? <p id={descriptionId}>{description}</p> : null}
            </div>
            <button className={styles.closeButton} type="button" onClick={closeModal} aria-label={`Close ${title}`}>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </header>
          <div className={styles.body}>{children}</div>
        </div>
      </dialog>
    </div>
  );
}