export type PortalCreationGuideAction = {
  label: string;
  href: string;
  primary?: boolean;
};

export type PortalCreationGuideStep = {
  number: number;
  title: string;
  summary: string;
  bullets?: string[];
  actions: PortalCreationGuideAction[];
};

export const PORTAL_CREATION_GUIDE: PortalCreationGuideStep[] = [
  {
    number: 1,
    title: "Create the request",
    summary: "Start one migration record for the portal. You should be given the two source items needed to begin.",
    bullets: [
      "Current company hierarchy",
      "Proposed SKU list",
    ],
    actions: [
      { label: "Open Portal migrations", href: "/migrations", primary: true },
    ],
  },
  {
    number: 2,
    title: "Complete the company hierarchy template",
    summary: "Use the current OGL company references. Leave parent_reference blank for the main/root company.",
    bullets: [
      "Each company needs its current OGL reference",
      "Child companies point to their parent reference",
      "If a company has no parent, leave parent_reference blank",
    ],
    actions: [
      { label: "Download hierarchy template", href: "/portal-migration-samples/company-structure.csv", primary: true },
    ],
  },
  {
    number: 3,
    title: "Complete the company products template",
    summary: "Add the proposed SKUs against the company reference they belong to.",
    actions: [
      { label: "Download products template", href: "/portal-migration-samples/company-products.csv", primary: true },
    ],
  },
  {
    number: 4,
    title: "Tell us the roles and users",
    summary: "List the required roles first, then the people who should belong to them.",
    bullets: [
      "Use the roles template to describe what each role should be able to do",
      "Users need a name, email address, role and company reference",
      "Do not worry about the live Fluid permission columns — the migration team maps those during import",
    ],
    actions: [
      { label: "Download roles template", href: "/portal-migration-samples/company-roles.csv" },
      { label: "Download users template", href: "/portal-migration-samples/company-users.csv", primary: true },
    ],
  },
  {
    number: 5,
    title: "Add restrictions only when needed",
    summary: "Only complete these templates when the customer has extra visibility or purchasing rules.",
    bullets: [
      "Role products: products visible only to a particular role",
      "Purchase controls: quantity / time allowances for a role",
      "Leave these out entirely when the customer does not need them",
    ],
    actions: [
      { label: "Role products template", href: "/portal-migration-samples/role-products.csv" },
      { label: "Purchase controls template", href: "/portal-migration-samples/purchase-controls.csv", primary: true },
    ],
  },
  {
    number: 6,
    title: "Add the portal content",
    summary: "Use the content template for the company description / landing-page text that should appear on the portal.",
    actions: [
      { label: "Download content template", href: "/portal-migration-samples/company-descriptions.csv", primary: true },
    ],
  },
  {
    number: 7,
    title: "Send the completed request to the migration team",
    summary: "That is your bit done. The migration team reviews the files, runs Preview, performs the imports and completes QA before go-live.",
    bullets: [
      "Sales / Area Managers do not upload CSV files",
      "Import Preview and Apply stay with the migration/admin team",
      "Use the migration record to track questions, blockers and progress",
    ],
    actions: [
      { label: "Back to Portal migrations", href: "/migrations", primary: true },
    ],
  },
];
