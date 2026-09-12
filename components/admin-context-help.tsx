"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { usePathname } from "next/navigation";
import { PurchaseControlDialog } from "@/components/purchase-control-dialog";
import { adminHelpForPathname } from "@/lib/admin-context-help";

export function AdminContextHelp() {
  const pathname = usePathname();
  const topic = adminHelpForPathname(pathname);
  const topicKey = topic?.key ?? null;
  const [heading, setHeading] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
    if (!topicKey) {
      setHeading(null);
      return;
    }

    setHeading(document.querySelector<HTMLElement>("main.content h1"));
  }, [pathname, topicKey]);

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
