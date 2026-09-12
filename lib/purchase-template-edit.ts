/** Serializable server-action result. Error responses keep the editor's controlled draft intact. */
export type PurchaseTemplateEditState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "saved"; templateId: number };
