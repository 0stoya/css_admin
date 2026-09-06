import { BulkImportWorkspace } from "@/components/bulk-import-workspace";

export default function BulkImportPage() {
  return (
    <div className="stack section-gap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Unlimited Admin workflow</p>
          <h1>Bulk import / export</h1>
          <p className="muted">Use company_ref-keyed CSV formats across several companies. Sidebar links and workspace tabs share the same URL-driven view.</p>
        </div>
      </header>
      <BulkImportWorkspace />
    </div>
  );
}
