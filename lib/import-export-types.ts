export type ImportRowStatus = "Created" | "Updated" | "Skipped" | "Error";

export type CompanyUserImportRow = {
  row: number;
  email: string;
  role_name: string;
  manager_email: string;
  approval_type: string;
  approval_threshold: number | null;
  status: ImportRowStatus;
  message: string;
};

export type CompanyUserImportState = {
  phase: "idle" | "preview" | "applied" | "error";
  sourceCsv: string;
  rows: CompanyUserImportRow[];
  error: string | null;
};

export type CompanyControlsImportOptions = {
  create_missing_roles: boolean;
  create_missing_templates: boolean;
  apply_purchase_templates: boolean;
};

export type CompanyControlsImportSummary = {
  format: string;
  schema_version: number;
  company_id: number;
  dry_run: boolean;
  valid: boolean;
  applied: boolean;
  roles_created: number;
  roles_updated: number;
  role_controls_saved: number;
  purchase_templates_created: number;
  purchase_templates_updated: number;
  purchase_templates_saved: number;
  purchase_template_users_applied: number;
};

export type CompanyControlsImportState = {
  phase: "idle" | "preview" | "applied" | "error";
  sourceJson: string;
  sourceCompanyId: number | null;
  options: CompanyControlsImportOptions;
  result: CompanyControlsImportSummary | null;
  error: string | null;
};
