import { BulkFlatImportPanels } from "@/components/flat-company-imports";

export default function BulkImportPage() {
  return (
    <div className="stack section-gap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Unlimited Admin workflow</p>
          <h1>Bulk import / export</h1>
          <p className="muted">Use the same company_ref-keyed CSV formats across several companies. Preview groups results by company before apply.</p>
        </div>
      </header>
      <div className="notice notice-preview">This surface is intended for Unlimited Admin operations. Magento/Fluid authorization remains authoritative for every company read, dry run and write; a restricted administrator cannot bypass backend ACLs through bulk import.</div>
      <BulkFlatImportPanels />
    </div>
  );
}
