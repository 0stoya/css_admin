"use client";

import { useActionState, useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil, Save } from "lucide-react";
import type { PurchaseControlTemplate } from "@/lib/graphql/purchase-controls";
import type { PurchaseTemplateEditState } from "@/lib/purchase-template-edit";
import { PurchaseRuleEditor } from "./purchase-rule-editor";
import { PurchaseControlDialog } from "./purchase-control-dialog";
import styles from "./purchase-control-modals.module.css";

type EditAction = (previous: PurchaseTemplateEditState, form: FormData) => Promise<PurchaseTemplateEditState>;
type Props = {
  companyId: number;
  template: PurchaseControlTemplate;
  saveAction: EditAction;
  successHref: string;
};

export function PurchaseTemplateEditModal(props: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const close = useCallback(() => setOpen(false), []);
  const saved = useCallback(() => {
    setOpen(false);
    router.replace(props.successHref, { scroll: false });
  }, [props.successHref, router]);

  return (
    <>
      <button className="button button-secondary icon-button-label" type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Pencil size={16} aria-hidden="true" /> Edit template
      </button>
      {open ? <EditDialog {...props} close={close} saved={saved} /> : null}
    </>
  );
}

function EditDialog({ companyId, template, saveAction, close, saved }: Props & { close: () => void; saved: () => void }) {
  const [state, action, pending] = useActionState(saveAction, { status: "idle" } as PurchaseTemplateEditState);
  const [name, setName] = useState(template.name);
  const nameId = useId();
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "saved") saved();
    if (state.status === "error") errorRef.current?.focus();
  }, [state, saved]);

  return (
    <PurchaseControlDialog
      open
      onClose={close}
      title="Edit template"
      description={`${template.name} · Template #${template.template_id}`}
      busy={pending}
      wide
      closeOnBackdrop={false}
      initialFocus="input"
    >
      <form action={action}>
        <div className={styles.body}>
          {state.status === "error" ? <div className={styles.error} role="alert" tabIndex={-1} ref={errorRef}>{state.message}</div> : null}
          <fieldset className={styles.fields} disabled={pending}>
            <input type="hidden" name="companyId" value={companyId} />
            <input type="hidden" name="templateId" value={template.template_id} />
            <div className="field">
              <label htmlFor={nameId}>Template name</label>
              <input id={nameId} name="name" required value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <PurchaseRuleEditor companyId={companyId} initialRules={template.rules} label="Product rules" />
          </fieldset>
          <p className={styles.saveNote}>Saving changes the template only. Existing buyer allowances and usage are unchanged until you apply it separately.</p>
        </div>
        <footer className={styles.footer}>
          <span className={styles.footerHint}>One quantity/time-window rule per product.</span>
          <button className="button button-secondary" type="button" onClick={close} disabled={pending}>Cancel</button>
          <button className="button icon-button-label" type="submit" disabled={pending}>
            {pending ? <LoaderCircle size={17} className={styles.spinner} aria-hidden="true" /> : <Save size={17} aria-hidden="true" />}
            {pending ? "Saving…" : "Save changes"}
          </button>
        </footer>
      </form>
    </PurchaseControlDialog>
  );
}
