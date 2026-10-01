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
    title: "Build the company hierarchy",
    summary: "Use the current OGL company references to populate the structure file. Leave parent_reference blank for the main/root company.",
    bullets: [
      "Each company must use its current OGL reference",
      "Child companies point to their parent reference",
      "Companies should be enabled in OGL and have the required admin email",
    ],
    actions: [
      { label: "Download structure sample", href: "/api/bulk-import/examples/company-structure" },
      { label: "Open Company structure", href: "/bulk-import", primary: true },
    ],
  },
  {
    number: 3,
    title: "Load the company products",
    summary: "Use the proposed SKU list with the matching company reference. This creates the company-wide product boundary.",
    actions: [
      { label: "Download products sample", href: "/api/bulk-import/examples/company-products" },
      { label: "Open Company products", href: "/bulk-import?view=company-products", primary: true },
    ],
  },
  {
    number: 4,
    title: "Create roles, then users",
    summary: "Create the roles first, then add the company users who belong to those roles.",
    bullets: [
      "Role permissions use 0 = not allowed and 1 = allowed",
      "Most portals begin with the agreed Admin / User roles unless the request says otherwise",
      "Users need an email address and must reference a role that already exists",
    ],
    actions: [
      { label: "Roles sample", href: "/api/bulk-import/examples/roles" },
      { label: "Users sample", href: "/api/bulk-import/examples/users" },
      { label: "Open Roles & permissions", href: "/bulk-import?view=roles", primary: true },
    ],
  },
  {
    number: 5,
    title: "Add restrictions only when needed",
    summary: "Only add the extra rules the customer actually needs. Do not create complexity for sport.",
    bullets: [
      "Role products restrict product visibility for a specific role",
      "Purchase controls restrict what / how much a user group can buy",
      "Use the agreed purchase-control template for each user group that needs an allowance",
    ],
    actions: [
      { label: "Role products sample", href: "/api/bulk-import/examples/role-products" },
      { label: "Purchase controls sample", href: "/api/bulk-import/examples/purchase-controls" },
      { label: "Open Role products", href: "/bulk-import?view=role-products" },
      { label: "Open Purchase controls", href: "/bulk-import?view=purchase-controls", primary: true },
    ],
  },
  {
    number: 6,
    title: "Add content, preview, then QA",
    summary: "Add the company description / portal content, Preview every import before Apply, then check the finished portal before go-live.",
    bullets: [
      "Resolve Preview errors before Apply",
      "Check hierarchy, login, visible products and purchasing rules",
      "Update the migration tracker as each step is completed",
    ],
    actions: [
      { label: "Descriptions sample", href: "/api/bulk-import/examples/company-descriptions" },
      { label: "Open Company descriptions", href: "/bulk-import?view=company-descriptions" },
      { label: "Open Portal migrations", href: "/migrations", primary: true },
    ],
  },
];
