export type AdminHelpSection = {
  heading: string;
  body: string;
};

export type AdminHelpTopic = {
  key: string;
  title: string;
  description: string;
  sections: AdminHelpSection[];
  note?: string;
};

const topics: Record<string, AdminHelpTopic> = {
  finance: {
    key: "finance",
    title: "About Finance",
    description: "How to read the OGL financial summary shown for this company.",
    sections: [
      { heading: "What spend means", body: "Spend is the OGL order value returned through Fluid. It is an operational sales view, not an accounting ledger balance." },
      { heading: "What is included", body: "The page groups the returned order value and order count into recent periods and calendar months." },
      { heading: "Source of truth", body: "The figures are read-only here. Credits, account transactions or other finance adjustments are not inferred by the Admin app." },
    ],
  },
  management: {
    key: "management",
    title: "About Users & roles",
    description: "The difference between company membership, roles, managers and approval settings.",
    sections: [
      { heading: "Company users", body: "These are Magento customer accounts linked to the company. They are different from beneficiary Employees, who do not log in." },
      { heading: "Roles and permissions", body: "Roles control Fluid company permissions. The Admin app shows the backend-authorized resources and does not create its own permission model." },
      { heading: "Approval settings", body: "Approval type and threshold belong to the company user. Template approval works with applied purchase-control allowances; value approval evaluates the basket total." },
      { heading: "Managers", body: "Manager relationships affect company hierarchy and approval/employee scope where Fluid uses them. Changing a role does not automatically change a manager." },
    ],
  },
  employees: {
    key: "employees",
    title: "About Employees",
    description: "How beneficiary Employees differ from buyers and how reporting is attributed.",
    sections: [
      { heading: "No login account", body: "Employees are canonical beneficiary records used to say who an item is for. They are not Magento customer accounts and do not sign in." },
      { heading: "Ordering scope", body: "Employee ordering can be enabled per company, with optional multi-employee baskets. Manager assignment controls which beneficiary records can be available in scoped flows." },
      { heading: "Product spend", body: "Employee reporting attributes ordered product value after line discounts and cancellations. Shipping is excluded, and refunds are not netted into this metric." },
      { heading: "Purchase controls", body: "Current quantity allowances belong to the company user placing the order. Assigning an Employee to a line does not create a separate Employee allowance." },
    ],
  },
  catalog: {
    key: "catalog",
    title: "About Catalogue policy",
    description: "How company and role catalogue boundaries combine.",
    sections: [
      { heading: "Company boundary", body: "The company catalogue is the maximum product/category boundary available to its roles." },
      { heading: "Role restrictions", body: "A role can narrow the company catalogue further. A role cannot use this screen to expand beyond the company boundary." },
      { heading: "Public catalogue", body: "Public catalogue visibility is a separate company-level setting. It does not replace the authenticated company/role restrictions." },
    ],
  },
  payment: {
    key: "payment",
    title: "About Payment configuration",
    description: "How the company payment policy affects checkout methods.",
    sections: [
      { heading: "Platform default", body: "Default means the company follows Fluid's current platform payment policy rather than storing a company-specific allowlist." },
      { heading: "All available", body: "All allows every payment method that Fluid currently reports as available for this company context." },
      { heading: "Specific methods", body: "Specific stores a company allowlist. A method can disappear from checkout if the backend no longer reports it as available, even when its code was previously saved." },
    ],
  },
  credit: {
    key: "credit",
    title: "About Company credit",
    description: "How to interpret the Fluid credit account shown here.",
    sections: [
      { heading: "Read-only balance", body: "Credit limit, used amount, remaining amount and currency come directly from Fluid. The Admin app does not recalculate the account balance." },
      { heading: "Over-limit policy", body: "Allow over limit is a backend credit policy. A hard limit and an approval workflow are separate controls and should not be treated as the same rule." },
      { heading: "Credit orders", body: "Credit-order approval and eventual sales-order creation are handled by the Fluid credit-order workflow, not by editing the numbers on this page." },
    ],
  },
  creditOrders: {
    key: "credit-orders",
    title: "About Credit orders",
    description: "Why this admin workflow can select an acting company user.",
    sections: [
      { heading: "Read-only by default", body: "Without an acting company user, the queue and order detail are read-only." },
      { heading: "Real actor permissions", body: "Selecting an acting company user asks Fluid to resolve that real user's permissions. It does not impersonate around authorization or grant the Magento admin extra company-user rights." },
      { heading: "Authorized actions", body: "Approve, reject, cancel, place and comment controls appear only when Fluid explicitly returns those actions for the selected actor and order state." },
      { heading: "Payment details", body: "Some approved orders still require the customer payment-details flow. The Admin app does not bypass that requirement." },
    ],
  },
  pricing: {
    key: "pricing",
    title: "About Pricing",
    description: "How OGL company pricing and Magento fallback pricing are presented.",
    sections: [
      { heading: "Pricing source", body: "When active company-specific OGL price rows exist, they override the relevant Magento catalogue prices for the company. Otherwise Magento pricing remains the fallback." },
      { heading: "Import health", body: "Sync state, import status and last-imported time describe the OGL pricing feed; they are not edited on this page." },
      { heading: "Tier breaks", body: "Tier prices are displayed exactly as Fluid returns them. The Admin app does not reconstruct or estimate missing tiers." },
    ],
  },
  importExport: {
    key: "import-export",
    title: "About Import / export",
    description: "The guarded CSV workflow for one company.",
    sections: [
      { heading: "Company reference", body: "Flat CSV formats use company_ref as their safety and routing key. A company reference is required before these workflows can run." },
      { heading: "Preview first", body: "Preview resolves and validates rows without applying the proposed writes. Review every result before continuing." },
      { heading: "Apply deliberately", body: "Apply writes the validated changes only after the preview step and any required confirmation. Downloaded current/example CSV files are intended to make that review reproducible." },
    ],
  },
  personalisation: {
    key: "personalisation",
    title: "About Personalisation",
    description: "Which presentation fields CSS owns and which representative data stays OGL-controlled.",
    sections: [
      { heading: "Company presentation", body: "Portal title, display contact overrides and CSS media are presentation data. Existing Fluid company landing-page fields are reused where shown." },
      { heading: "Representative assignment", body: "OGL remains authoritative for which representative is assigned. Personalisation changes how the resolved representative is presented, not who the rep code maps to." },
      { heading: "Visibility", body: "Representative visibility is backend-enforced for authorized company users. Ordinary buyers can receive company presentation without receiving personal rep details." },
    ],
  },
  settings: {
    key: "settings",
    title: "About Company settings",
    description: "The ownership boundary between synced company data, Magento-local settings and destructive actions.",
    sections: [
      { heading: "Company data", body: "Identity and contact values in the Company data view are owned by onboarding/OGL sync and are intentionally read-only here." },
      { heading: "Local settings", body: "The Local settings view contains fields outside the current OGL writer. Saving them does not rewrite the protected synced fields." },
      { heading: "Hierarchy", body: "Parent/child company relationships are managed through the company-structure workflow and are preserved by local settings saves." },
      { heading: "Danger zone", body: "Destructive lifecycle actions are intentionally separated from normal settings. Treat them as irreversible unless the underlying Magento operation explicitly provides recovery." },
    ],
  },
  bulkImport: {
    key: "bulk-import",
    title: "About Bulk import / export",
    description: "The multi-company CSV workflow and its safety boundaries.",
    sections: [
      { heading: "Multi-company scope", body: "Bulk files can affect several companies, so company_ref is used to resolve and route each row." },
      { heading: "Preview before apply", body: "Choose CSV, preview the resolved changes, then apply only after reviewing created, updated, skipped and error rows." },
      { heading: "Structure order matters", body: "Company hierarchy and role/product relationships can depend on referenced records already existing. Use the dedicated workspace for the relationship you are changing." },
    ],
  },
  ogl: {
    key: "ogl",
    title: "About OGL administration",
    description: "How registry fetch, sync eligibility, imports and representative routing differ.",
    sections: [
      { heading: "Fetch registry", body: "Fetch refreshes the local view of OGL company references and source data. It does not by itself import every company into Magento." },
      { heading: "Sync eligibility", body: "Sync enabled marks which OGL companies are eligible for the import/sync workflow. Queue actions operate on the eligible selection." },
      { heading: "Representative routing", body: "Rep-code mappings connect OGL representative codes to Magento administrators. Company overrides are explicit exceptions to the mapped default." },
    ],
  },
  repProfiles: {
    key: "rep-profiles",
    title: "About Representative profiles",
    description: "Presentation data for OGL representative mappings.",
    sections: [
      { heading: "Presentation only", body: "Profile photo, display contacts, job title and message change the reusable contact card only." },
      { heading: "Mapping stays authoritative", body: "Editing a profile never changes which Magento administrator the OGL rep code maps to. Use Rep mappings for assignment changes." },
      { heading: "Visibility", body: "A hidden/inactive profile is suppressed from company-user presentation without deleting the underlying rep-code mapping." },
    ],
  },
};

export function adminHelpForPathname(pathname: string): AdminHelpTopic | null {
  if (!pathname.startsWith("/")) return null;
  if (pathname === "/bulk-import" || pathname.startsWith("/bulk-import/")) return topics.bulkImport;
  if (pathname === "/ogl/rep-profiles" || pathname.startsWith("/ogl/rep-profiles/")) return topics.repProfiles;
  if (pathname === "/ogl" || pathname.startsWith("/ogl/")) return topics.ogl;

  const match = pathname.match(/^\/companies\/\d+(?:\/([^/]+))?(?:\/.*)?$/);
  if (!match) return null;
  const section = match[1] ?? "";

  if (!section || section === "purchase-controls") return null;
  if (section === "finance") return topics.finance;
  if (section === "management") return topics.management;
  if (section === "employees") return topics.employees;
  if (section === "catalog") return topics.catalog;
  if (section === "payment") return topics.payment;
  if (section === "credit-orders") return topics.creditOrders;
  if (section === "credit") return topics.credit;
  if (section === "pricing") return topics.pricing;
  if (section === "import-export") return topics.importExport;
  if (section === "personalisation") return topics.personalisation;
  if (section === "settings") return topics.settings;
  return null;
}
