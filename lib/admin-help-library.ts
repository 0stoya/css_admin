export type AdminHelpSection = {
  heading: string;
  body: string;
  bullets?: string[];
};

export type AdminHelpArticle = {
  slug: string;
  category: "Portal migration" | "Imports & CSV" | "Users & roles" | "Catalogue" | "Purchase controls";
  title: string;
  summary: string;
  sections: AdminHelpSection[];
};

export const ADMIN_HELP_ARTICLES: AdminHelpArticle[] = [
  {
    slug: "portal-migration-overview",
    category: "Portal migration",
    title: "How do I migrate a portal?",
    summary: "The standard order for moving one OGL / Tower portal into CSS Commerce.",
    sections: [
      {
        heading: "Start with one migration record",
        body: "Create one Portal migration record for the root company hierarchy. Use the OGL root company reference as the durable reference and assign an internal owner.",
      },
      {
        heading: "Prepare data in dependency order",
        body: "Work through the migration checklist rather than treating each CSV as an unrelated upload.",
        bullets: [
          "Company hierarchy",
          "Company products",
          "Roles & permissions",
          "Company users",
          "Role product restrictions",
          "Purchase controls",
          "Company descriptions and personalisation",
        ],
      },
      {
        heading: "Preview before apply",
        body: "Bulk import preview is the safety gate. Resolve errors and confirm the proposed writes before Apply.",
      },
      {
        heading: "Finish with QA",
        body: "Check hierarchy, login, catalogue visibility, permissions and purchasing behaviour before moving the migration to Live.",
      },
    ],
  },
  {
    slug: "company-structure-csv",
    category: "Imports & CSV",
    title: "How does the company structure CSV work?",
    summary: "Use company references to define the root and child company hierarchy.",
    sections: [
      {
        heading: "Columns",
        body: "The structure import uses company_reference and parent_reference. References route the relationship without relying on Magento IDs.",
      },
      {
        heading: "Root company",
        body: "Leave parent_reference blank for the root company. Child rows point parent_reference at the company reference they belong beneath.",
      },
      {
        heading: "Validation",
        body: "Preview blocks unknown references, duplicate company rows, self-parenting and hierarchy cycles before Apply.",
      },
    ],
  },
  {
    slug: "recommended-import-order",
    category: "Imports & CSV",
    title: "What order should I import portal data?",
    summary: "Create dependencies before records that reference them.",
    sections: [
      {
        heading: "Recommended order",
        body: "The migration tracker checklist follows the safest dependency order.",
        bullets: [
          "1. Company structure",
          "2. Company products",
          "3. Roles & permissions",
          "4. Company users",
          "5. Role products",
          "6. Purchase controls",
          "7. Company descriptions / personalisation",
          "8. Internal QA",
        ],
      },
      {
        heading: "Why roles come before users",
        body: "Company-user rows reference existing company roles. Creating the role first keeps preview results deterministic and avoids avoidable dependency errors.",
      },
    ],
  },
  {
    slug: "users-and-roles",
    category: "Users & roles",
    title: "Why must roles exist before company users?",
    summary: "Company memberships use roles that already exist in the target company.",
    sections: [
      {
        heading: "Company users",
        body: "Company users are Magento customer accounts linked to the company. The bulk user workflow resolves the account by email and applies the referenced company membership.",
      },
      {
        heading: "Roles",
        body: "Roles carry Fluid company permissions. Create or validate the role before importing users that refer to it.",
      },
      {
        heading: "Employees are different",
        body: "Beneficiary Employees are not company login accounts. They represent who an item is for and should not be confused with company users.",
      },
    ],
  },
  {
    slug: "company-v-role-products",
    category: "Catalogue",
    title: "What is the difference between company products and role products?",
    summary: "Company products set the outer catalogue boundary; role products can narrow it.",
    sections: [
      {
        heading: "Company products",
        body: "The company catalogue is the maximum SKU boundary available to the company hierarchy.",
      },
      {
        heading: "Role products",
        body: "Role product restrictions narrow visibility for a particular company role. They do not expand beyond the company catalogue.",
      },
      {
        heading: "A useful rule",
        body: "If a SKU should be unavailable to everyone in the company, remove it at company level. If only one role should not see it, use the role restriction.",
      },
    ],
  },
  {
    slug: "purchase-controls",
    category: "Purchase controls",
    title: "What do Purchase Controls actually restrict?",
    summary: "Purchase Controls govern purchasing allowances; catalogue restrictions govern visibility.",
    sections: [
      {
        heading: "Visibility versus allowance",
        body: "Company and role product restrictions control what a buyer can see. Purchase Controls govern whether and how much a user can buy within an allowance period.",
      },
      {
        heading: "Templates",
        body: "A template groups SKU quantity rules and can be assigned to company roles. The bulk workflow can create missing templates and apply imported templates to assigned users when explicitly selected.",
      },
      {
        heading: "Migration use",
        body: "Mark the Purchase Controls checklist item Not applicable when a portal genuinely has no purchasing allowance policy. Do not create dummy controls just to make the progress bar green.",
      },
    ],
  },
  {
    slug: "migration-readiness",
    category: "Portal migration",
    title: "What does Ready mean in the migration tracker?",
    summary: "Readiness is calculated from the checklist, not from somebody saying 'basically done'.",
    sections: [
      {
        heading: "Resolved steps",
        body: "Complete and Not applicable both count as resolved. Blocked, In progress and Not started do not.",
      },
      {
        heading: "Blocked work",
        body: "Any blocked checklist item is shown prominently in the queue and migration detail so the programme view exposes stalled portals quickly.",
      },
      {
        heading: "Stage versus readiness",
        body: "Stage is the programme status you set manually. Readiness is calculated from the checklist. Keeping them separate avoids a portal being labelled Ready to live while required work is still unresolved.",
      },
    ],
  },
  {
    slug: "migration-not-applicable",
    category: "Portal migration",
    title: "When should I use Not applicable?",
    summary: "Use it for a real non-requirement, not as a shortcut around unfinished work.",
    sections: [
      {
        heading: "Good examples",
        body: "A portal with no role-specific catalogue restrictions or no Purchase Controls may legitimately mark those steps Not applicable.",
      },
      {
        heading: "Bad example",
        body: "An import that still has errors is not Not applicable. It is Blocked or In progress until the issue is resolved.",
      },
    ],
  },
  {
    slug: "bulk-preview-errors",
    category: "Imports & CSV",
    title: "What should I do when Bulk Import preview returns errors?",
    summary: "Treat preview errors as the work queue; do not apply around them.",
    sections: [
      {
        heading: "Read the row result",
        body: "Preview resolves the company reference and validates the relationship or write before anything is applied. Use the row message to identify the missing reference, role, SKU or invalid relationship.",
      },
      {
        heading: "Fix dependencies first",
        body: "If several rows fail because a referenced role or company relationship is missing, fix that prerequisite first, then preview the original file again.",
      },
      {
        heading: "Record real blockers",
        body: "If the issue cannot be resolved immediately, mark the matching migration checklist item Blocked and add the reason. That makes the problem visible without hunting through Teams chat.",
      },
    ],
  },
];

export const ADMIN_HELP_CATEGORIES = [
  "Portal migration",
  "Imports & CSV",
  "Users & roles",
  "Catalogue",
  "Purchase controls",
] as const;

export function findAdminHelpArticles(query: string, category: string) {
  const normalizedQuery = query.trim().toLowerCase();
  return ADMIN_HELP_ARTICLES.filter((article) => {
    if (category && article.category !== category) return false;
    if (!normalizedQuery) return true;

    const haystack = [
      article.title,
      article.summary,
      article.category,
      ...article.sections.flatMap((section) => [
        section.heading,
        section.body,
        ...(section.bullets ?? []),
      ]),
    ].join(" ").toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}
