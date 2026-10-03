"use client";

import { useState } from "react";
import { CircleHelp } from "lucide-react";
import { PurchaseControlDialog } from "@/components/purchase-control-dialog";

type PermissionItem = {
  parameter: string;
  meaning: string;
};

type PermissionGroup = {
  title: string;
  description: string;
  items: PermissionItem[];
};

const permissionGroups: PermissionGroup[] = [
  {
    title: "Sales",
    description: "Ordering and sales-order visibility.",
    items: [
      {
        parameter: "Sales",
        meaning: "The Sales ACL branch. Child permissions are still separate CSV columns and are imported independently.",
      },
      {
        parameter: "Sales > Allow Checkout",
        meaning: "Allows the user to proceed through checkout and place an order when the company is active and all other checkout rules allow it.",
      },
      {
        parameter: "Sales > Allow Checkout > Use Pay On Account method",
        meaning: "Allows Pay On Account / company-credit payment when that method is otherwise available for the company and checkout.",
      },
      {
        parameter: "Sales > View orders",
        meaning: "Allows access to the user's own sales-order history in company context.",
      },
      {
        parameter: "Sales > View orders > View all company orders",
        meaning: "Expands order visibility beyond the user's own orders to the company/hierarchy scope Fluid authorizes.",
      },
    ],
  },
  {
    title: "Company Credit Orders",
    description: "Permissions for the credit-order approval workflow.",
    items: [
      {
        parameter: "Company Credit Orders",
        meaning: "The Company Credit Orders ACL branch. Its child actions remain separate permissions.",
      },
      {
        parameter: "Company Credit Orders > View Own Credit Orders",
        meaning: "Allows the user to see credit orders they submitted themselves.",
      },
      {
        parameter: "Company Credit Orders > View All Company Credit Orders",
        meaning: "Allows broader company credit-order visibility within the scope Fluid authorizes.",
      },
      {
        parameter: "Company Credit Orders > Approve/Reject Credit Orders",
        meaning: "Allows approval or rejection actions for eligible credit orders. Order state and lifecycle rules are still enforced by Fluid.",
      },
      {
        parameter: "Company Credit Orders > Auto-approve own credit orders",
        meaning: "Allows the user's own credit order to auto-approve when the credit-order configuration and submission rules permit it.",
      },
      {
        parameter: "Company Credit Orders > Enter PO Numbers",
        meaning: "Allows entry of purchase-order reference numbers in the credit-order workflow where that field is exposed.",
      },
    ],
  },
  {
    title: "Company Profile",
    description: "Read access to company profile information.",
    items: [
      {
        parameter: "Company Profile",
        meaning: "The Company Profile ACL branch. The individual profile areas below remain separate permissions.",
      },
      {
        parameter: "Company Profile > Account Information (View)",
        meaning: "Allows viewing the company's account-information section.",
      },
      {
        parameter: "Company Profile > Legal Address (View)",
        meaning: "Allows viewing the company's legal-address section.",
      },
      {
        parameter: "Company Profile > Contacts (View)",
        meaning: "Allows viewing company contact information.",
      },
      {
        parameter: "Company Profile > Payment Information (View)",
        meaning: "Allows viewing the company's payment-information/configuration section where available.",
      },
    ],
  },
  {
    title: "Company User Management",
    description: "Company users, roles and delegated administration.",
    items: [
      {
        parameter: "Company User Management",
        meaning: "The Company User Management ACL branch. User, role and impersonation capabilities remain separate permissions.",
      },
      {
        parameter: "Company User Management > Impersonation of company users",
        meaning: "Allows Fluid's company-user impersonation capability where that feature is enabled and exposed.",
      },
      {
        parameter: "Company User Management > View roles and permissions",
        meaning: "Allows viewing company roles and their permission assignments.",
      },
      {
        parameter: "Company User Management > View roles and permissions > Manage roles and permissions",
        meaning: "Allows creating or updating manageable company roles and their permissions. Protected/non-manageable roles remain protected by Fluid.",
      },
      {
        parameter: "Company User Management > View users",
        meaning: "Allows viewing users linked to the company.",
      },
      {
        parameter: "Company User Management > View users > Manage users",
        meaning: "Allows supported add/update/remove company-user actions. Fluid still enforces company-administrator and other protection rules.",
      },
    ],
  },
  {
    title: "Catalogue, Employees & Controls",
    description: "Catalogue access, beneficiary employees, purchase controls and account contacts.",
    items: [
      {
        parameter: "Access Public Catalog",
        meaning: "Allows access to the public-catalogue path where the company catalogue policy permits it. This permission does not itself edit catalogue restrictions.",
      },
      {
        parameter: "Manage Catalog Visibility",
        meaning: "Allows the catalogue-visibility management capability exposed for company roles, within the company's overall catalogue boundary.",
      },
      {
        parameter: "Employees",
        meaning: "The Employees ACL branch for beneficiary Employee records. Employees are not customer login accounts.",
      },
      {
        parameter: "Employees > View Employees",
        meaning: "Allows viewing beneficiary Employee records available in the user's company scope.",
      },
      {
        parameter: "Employees > Manage Employees",
        meaning: "Allows supported create/update/manage actions for beneficiary Employee records.",
      },
      {
        parameter: "Purchase Controls",
        meaning: "The Purchase Controls ACL branch for purchase-control templates and applied allowances.",
      },
      {
        parameter: "Purchase Controls > View Purchase Controls",
        meaning: "Allows viewing purchase-control templates, applied restrictions and related history exposed by Fluid.",
      },
      {
        parameter: "Purchase Controls > Manage Purchase Controls",
        meaning: "Allows supported purchase-control management actions such as template/assignment changes and apply/reset operations, subject to Fluid validation.",
      },
      {
        parameter: "Account Representative",
        meaning: "The Account Representative ACL branch.",
      },
      {
        parameter: "Account Representative > View Account Representative",
        meaning: "Allows viewing the account representative/contact details returned for the company.",
      },
    ],
  },
  {
    title: "Company Credit",
    description: "Company-credit information and configured credit actions.",
    items: [
      {
        parameter: "Company Credit",
        meaning: "The Company Credit ACL branch.",
      },
      {
        parameter: "Company Credit > View",
        meaning: "Allows access to company-credit information/history where the credit feature is available.",
      },
      {
        parameter: "Company Credit > Edit",
        meaning: "Allows the credit edit/request capability exposed by the configured company-credit workflow. Fluid remains authoritative for which credit actions are actually available.",
      },
    ],
  },
];

const fixedFields = [
  {
    parameter: "user_role",
    required: "Yes",
    meaning: "Company role name. Existing roles are matched after trimming and case-normalising the name. A role may appear only once per company in the file. A missing role can be created only when Create missing roles is enabled.",
  },
  {
    parameter: "company_ref",
    required: "Yes",
    meaning: "Company safety/routing key. In a company-scoped import it must match the company currently open. In Bulk import it routes the row to the target company. Unknown or ambiguous references are rejected.",
  },
  {
    parameter: "sort_order",
    required: "No",
    meaning: "Integer sort-order value stored with the role. Leave it blank to use 0.",
  },
] as const;

const quickSteps = [
  {
    heading: "Start fresh",
    body: "Download the current CSV or a fresh example so the permission headers match Fluid's live resource tree.",
  },
  {
    heading: "One row per role",
    body: "Keep user_role, company_ref and sort_order first, then set every permission column for that role.",
  },
  {
    heading: "Preview first",
    body: "Upload the CSV and resolve every preview error. Preview performs validation without writing the role changes.",
  },
  {
    heading: "Apply after review",
    body: "Apply only when the preview shows the intended Created, Updated or Skipped results.",
  },
] as const;

const faq = [
  {
    question: "Can I rename, remove or reorder permission columns?",
    answer: "No. The permission columns must exactly match the current Fluid permission tree, including order and full path. Download a fresh example/export if Fluid reports a mismatch.",
  },
  {
    question: "What values can I use for a permission?",
    answer: "Generated files use 1 and 0. The importer also accepts true/false, yes/no and y/n. A blank permission cell is treated as false.",
  },
  {
    question: "Does setting a parent permission to 1 automatically enable its children?",
    answer: "No. Every permission column is read independently from the CSV. Set the exact columns you want rather than relying on a parent row to cascade.",
  },
  {
    question: "What happens to a permission that is 0 or blank?",
    answer: "For an existing role, that assignable permission is excluded from the desired role state and can therefore be removed when the import is applied.",
  },
  {
    question: "What happens to roles that are not in the CSV?",
    answer: "They are untouched. The import only evaluates roles named in the file.",
  },
  {
    question: "Can the CSV create a role that does not exist?",
    answer: "Yes, but only when Create missing roles is selected. Without that option, a missing role is a preview error.",
  },
  {
    question: "What about protected roles and protected permissions?",
    answer: "Fluid blocks protected/non-manageable roles. Existing non-assignable protected resources on a manageable role are preserved rather than removed by the CSV.",
  },
  {
    question: "Does this CSV change users or product restrictions?",
    answer: "No. The roles import writes role name/sort order/allowed resources only. Role product restrictions, company product restrictions and company-user membership are separate workflows.",
  },
  {
    question: "How many rows can I import?",
    answer: "A roles preview accepts up to 5,000 data rows.",
  },
  {
    question: "What is different in Bulk import?",
    answer: "company_ref routes each row. Every referenced company must expose the same current Fluid permission-column tree for one shared matrix to be valid.",
  },
] as const;

export function RolePermissionsCsvHelp() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="button button-secondary" type="button" onClick={() => setOpen(true)}>
        <CircleHelp size={16} aria-hidden="true" />
        CSV field guide
      </button>

      <PurchaseControlDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Roles & permissions CSV guide"
        description="What every field means, what 1 and 0 do, and how to prepare a safe role-permission import."
        wide
      >
        <div className="admin-context-help-body">
          <div className="admin-context-help-grid">
            {quickSteps.map((step, index) => (
              <section className="admin-context-help-card" key={step.heading}>
                <span className="admin-context-help-number" aria-hidden="true">{index + 1}</span>
                <div>
                  <h3>{step.heading}</h3>
                  <p>{step.body}</p>
                </div>
              </section>
            ))}
          </div>

          <aside className="admin-context-help-note">
            <strong>Important:</strong> each row describes the complete desired set of assignable permissions for that role.
            A permission set to <strong>0</strong> or left blank is not merely ignored; it can remove that assignable permission
            from an existing role when you Apply. Protected/non-assignable resources are preserved.
          </aside>

          <section className="stack">
            <div>
              <p className="eyebrow">CSV structure</p>
              <h3>Fixed fields</h3>
              <p className="muted small-text">These three columns must come first and keep these exact names.</p>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Parameter</th><th>Required</th><th>What it means</th></tr>
                </thead>
                <tbody>
                  {fixedFields.map((field) => (
                    <tr key={field.parameter}>
                      <td><code>{field.parameter}</code></td>
                      <td>{field.required}</td>
                      <td>{field.meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card stack">
            <div>
              <p className="eyebrow">Permission cells</p>
              <h3>How to express Allow / Do not allow</h3>
            </div>
            <div className="button-row">
              <span className="badge badge-ok">Allow: 1 · true · yes · y</span>
              <span className="badge badge-neutral">Do not allow: 0 · false · no · n · blank</span>
            </div>
            <p className="muted small-text">
              Values are case-insensitive. The example CSV uses 1 and 0 because they are easiest to scan in Excel.
              Permission headers are generated from Fluid's current assignable ACL tree and must remain unchanged.
            </p>
          </section>

          <section className="stack">
            <div>
              <p className="eyebrow">Permission glossary</p>
              <h3>What each permission column controls</h3>
              <p className="muted small-text">
                Parent/group columns and child columns are imported independently. A granted permission never bypasses
                company status, catalogue boundaries, workflow state or any other backend validation.
              </p>
            </div>

            {permissionGroups.map((group) => (
              <details className="card stack" key={group.title}>
                <summary><strong>{group.title}</strong> <span className="muted">— {group.description}</span></summary>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>CSV permission parameter</th><th>What it controls</th></tr>
                    </thead>
                    <tbody>
                      {group.items.map((item) => (
                        <tr key={item.parameter}>
                          <td><strong>{item.parameter}</strong></td>
                          <td>{item.meaning}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </section>

          <section className="stack">
            <div>
              <p className="eyebrow">FAQ</p>
              <h3>Common questions</h3>
            </div>
            {faq.map((item) => (
              <details className="card stack" key={item.question}>
                <summary><strong>{item.question}</strong></summary>
                <p className="muted">{item.answer}</p>
              </details>
            ))}
          </section>
        </div>

        <footer className="admin-context-help-footer">
          <button className="button" type="button" onClick={() => setOpen(false)}>Got it</button>
        </footer>
      </PurchaseControlDialog>
    </>
  );
}
