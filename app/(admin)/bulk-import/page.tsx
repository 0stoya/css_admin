import { BulkImportWorkspace } from "@/components/bulk-import-workspace";

export default function BulkImportPage() {
  return (
    <div className="stack section-gap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Multi-company operations</p>
          <h1>Bulk import / export</h1>
          <p className="muted">Route one reviewed CSV across several companies using company references rather than internal Magento IDs.</p>
        </div>
      </header>

      <BulkImportWorkspace />
    </div>
  );
}
