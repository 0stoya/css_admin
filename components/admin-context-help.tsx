"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { usePathname } from "next/navigation";
import { PurchaseControlDialog } from "@/components/purchase-control-dialog";
import { adminHelpForPathname } from "@/lib/admin-context-help";

const HEADING_SELECTOR = "main.content h1";

function subscribeToHeading(onStoreChange: () => void) {
  if (typeof document === "undefined" || !document.body || typeof MutationObserver === "undefined") {
    return () => undefined;
  }

  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

function getHeadingSnapshot() {
  if (typeof document === "undefined") return null;
  return document.querySelector<HTMLElement>(HEADING_SELECTOR);
}

function getServerHeadingSnapshot() {
  return null;
}

export function AdminContextHelp() {
  const pathname = usePathname();
  const topic = adminHelpForPathname(pathname);
  const topicKey = topic?.key ?? null;
  const heading = useSyncExternalStore(subscribeToHeading, getHeadingSnapshot, getServerHeadingSnapshot);
  const dialogKey = `${pathname}\u0000${topicKey ?? ""}`;
  const [dialogState, setDialogState] = useState(() => ({ dialogKey, open: false }));
  const open = dialogState.dialogKey === dialogKey ? dialogState.open : false;

  function setOpen(nextOpen: boolean) {
    setDialogState({ dialogKey, open: nextOpen });
  }

  if (!topic) return null;

  return (
    <>
      {heading ? createPortal(
        <button
          className="admin-context-help-trigger"
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-label={`About ${topic.title.replace(/^About /, "")}`}
          title={topic.title}
        >
          <Info size={18} aria-hidden="true" />
        </button>,
        heading,
      ) : null}

      <PurchaseControlDialog
        open={open}
        onClose={() => setOpen(false)}
        title={topic.title}
        description={topic.description}
      >
        <div className="admin-context-help-body">
          <div className="admin-context-help-grid">
            {topic.sections.map((section, index) => (
              <section className="admin-context-help-card" key={section.heading}>
                <span className="admin-context-help-number" aria-hidden="true">{index + 1}</span>
                <div>
                  <h3>{section.heading}</h3>
                  <p>{section.body}</p>
                </div>
              </section>
            ))}
          </div>
          {topic.note ? <aside className="admin-context-help-note">{topic.note}</aside> : null}
        </div>
        <footer className="admin-context-help-footer">
          <button className="button" type="button" onClick={() => setOpen(false)}>Got it</button>
        </footer>
      </PurchaseControlDialog>
    </>
  );
}
