import { graphqlRequest } from "@/lib/graphql/client";
import type {
  CompanyControlsImportOptions,
  CompanyControlsImportSummary,
} from "@/lib/import-export-types";

export type CompanyControlsBundle = {
  format: string;
  schema_version: number;
  company_id: number;
  company_catalog: {
    allow_public_catalog: boolean;
    category_restriction: boolean;
    allowed_category_ids: number[];
    product_restriction: boolean;
    allowed_product_skus: string[];
  };
  role_controls: Array<{
    role_name: string;
    sort_order: number;
    allowed_resources: string[];
    selected_category_ids: number[];
    preselect_all_products: boolean;
    allowed_product_skus: string[];
  }>;
  purchase_controls?: {
    templates: Array<{
      name: string;
      rules: Array<{
        sku: string;
        quantity_limit: number;
        duration_days: number;
        start_date: string;
      }>;
      assigned_role_names: string[];
    }>;
  };
};

export type CompanyControlsImportInput = CompanyControlsBundle &
  CompanyControlsImportOptions & {
    dry_run: boolean;
  };

type ExportData = {
  css_admin_company_controls_export: Omit<CompanyControlsBundle, "company_catalog"> & {
    company_catalog: Omit<CompanyControlsBundle["company_catalog"], "allowed_product_skus"> & {
      allowed_products: Array<{ sku: string }>;
    };
  };
};

type ImportData = {
  cssAdminImportCompanyControls: CompanyControlsImportSummary;
};

const COMPANY_CONTROLS_EXPORT_QUERY = /* GraphQL */ `
  query AdminCompanyControlsExport($companyId: Int!) {
    css_admin_company_controls_export(company_id: $companyId) {
      format
      schema_version
      company_id
      company_catalog {
        allow_public_catalog
        category_restriction
        allowed_category_ids
        product_restriction
        allowed_products { sku }
      }
      role_controls {
        role_name
        sort_order
        allowed_resources
        selected_category_ids
        preselect_all_products
        allowed_product_skus
      }
      purchase_controls {
        templates {
          name
          rules {
            sku
            quantity_limit
            duration_days
            start_date
          }
          assigned_role_names
        }
      }
    }
  }
`;

const COMPANY_CONTROLS_IMPORT_MUTATION = /* GraphQL */ `
  mutation AdminImportCompanyControls($input: CssAdminImportCompanyControlsInput!) {
    cssAdminImportCompanyControls(input: $input) {
      format
      schema_version
      company_id
      dry_run
      valid
      applied
      roles_created
      roles_updated
      role_controls_saved
      purchase_templates_created
      purchase_templates_updated
      purchase_templates_saved
      purchase_template_users_applied
    }
  }
`;

export async function getCompanyControlsBundle(companyId: number): Promise<CompanyControlsBundle> {
  const data = await graphqlRequest<ExportData, { companyId: number }>(
    COMPANY_CONTROLS_EXPORT_QUERY,
    { companyId },
  );
  const bundle = data.css_admin_company_controls_export;

  return {
    format: bundle.format,
    schema_version: bundle.schema_version,
    company_id: bundle.company_id,
    company_catalog: {
      allow_public_catalog: bundle.company_catalog.allow_public_catalog,
      category_restriction: bundle.company_catalog.category_restriction,
      allowed_category_ids: bundle.company_catalog.allowed_category_ids,
      product_restriction: bundle.company_catalog.product_restriction,
      allowed_product_skus: bundle.company_catalog.allowed_products.map((product) => product.sku),
    },
    role_controls: bundle.role_controls,
    purchase_controls: bundle.purchase_controls,
  };
}

export async function importCompanyControls(input: CompanyControlsImportInput) {
  const data = await graphqlRequest<ImportData, { input: CompanyControlsImportInput }>(
    COMPANY_CONTROLS_IMPORT_MUTATION,
    { input },
  );
  return data.cssAdminImportCompanyControls;
}
