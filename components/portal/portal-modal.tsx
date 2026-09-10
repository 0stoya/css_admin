"use client";

import { useId, useRef, type MouseEvent, type ReactNode } from "react";
import styles from "./portal-modal.module.css";

type PortalModalProps = {
  title: string;
  description?: string;
  triggerLabel: string;
  triggerHint?: string;
  variant?: "primary" | "row";
  children: ReactNode;
};

export function PortalModal({
  title,
  description,
  triggerLabel,
  triggerHint,
  variant = "primary",
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
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          {isRow ? <path d="m9 18 6-6-6-6" /> : <><path d="M12 5v14" /><path d="M5 12h14" /></>}
        </svg>
      </button>

      <dialog
        ref={dialogRef}
        className={styles.dialog}
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
