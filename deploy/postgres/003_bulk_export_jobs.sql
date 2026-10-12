-- Phase 2: allow the existing private export-job queue to hold all seven
-- /bulk-import CSV datasets. Apply manually with a backup BEFORE deploying
-- the new worker/web build. Existing XLSX jobs remain unchanged.
-- No Magento/Fluid schema or application deployment is involved.
BEGIN;

-- PostgreSQL generated these names for the inline CHECK clauses in 002.
ALTER TABLE css_admin.export_job
  DROP CONSTRAINT IF EXISTS export_job_export_kind_check,
  DROP CONSTRAINT IF EXISTS export_job_company_ids_check,
  DROP CONSTRAINT IF EXISTS export_job_total_companies_check;

ALTER TABLE css_admin.export_job
  ADD CONSTRAINT export_job_export_kind_check CHECK (export_kind IN (
    'company_structure_products',
    'bulk_company_structure',
    'bulk_users',
    'bulk_roles',
    'bulk_role_products',
    'bulk_company_products',
    'bulk_company_descriptions',
    'bulk_purchase_controls'
  )),
  ADD CONSTRAINT export_job_company_ids_check
    CHECK (cardinality(company_ids) BETWEEN 1 AND 10000),
  ADD CONSTRAINT export_job_total_companies_check
    CHECK (total_companies BETWEEN 1 AND 10000);

-- Keep the existing count match, root-in-scope, owner, lease, status and
-- ready-artifact constraints, plus all queue indexes, untouched.
COMMIT;
