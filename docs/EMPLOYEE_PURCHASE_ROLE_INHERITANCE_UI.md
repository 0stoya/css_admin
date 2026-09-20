# Employee Purchase Role Inheritance — Admin UI

Status: design / implementation tracker  
Started: 2026-09-20  
Backend contract: Fluid PR #96

## Goal

Simplify Employee purchase-control administration by letting Employees inherit the purchase-control template already assigned to an existing company role.

The UI must preserve the identity boundary:

- company roles remain real user/ACL roles;
- Employees remain non-login beneficiary identities;
- assigning a Purchase Role to an Employee must not imply permissions or login access.

## Target UX

### Employee Add/Edit

Add a nullable **Purchase role** selector populated from the company's existing roles.

Helper copy:

“Purchase role controls purchase-policy inheritance only. It does not create a login or grant role permissions.”

Changing Purchase Role does not immediately rewrite current applied allowances.

### Employee Purchase Controls modal

Show:

- Purchase role;
- Effective template;
- Source badge:
  - Inherited from role
  - Direct override
  - None
- current applied allowances.

Rename the existing direct template control to **Override template**.

Override precedence:

1. direct override;
2. Purchase Role template;
3. none.

Removing an override should visibly fall back to the inherited role template when one exists.

### Purchase Controls — Role Assignments

Each role row should show:

- existing buyer user count;
- Employee Purchase Role count;
- assigned purchase-control template.

“Apply immediately” continues to apply buyer users and now also applies inheriting Employees. Mutation notices must report separate truthful counts.

Example:

“Template applied to 4 eligible buyers and 126 Employees.”

### Template Apply / Reset

Template operations should surface:

- affected buyers;
- affected Employees.

No local affected-count inference.

## GraphQL fields expected from Fluid #96

Employee:

- `purchase_control_role_id`

Employee purchase-control state:

- `purchase_control_role_id`
- `purchase_control_role_name`
- `assignment_source`
- `direct_template_id`
- `direct_template_name`
- effective `template_id` / `template_name`

Purchase-control role:

- `employee_count`

Role assignment mutation:

- `applied_users`
- `applied_employees`

Template Apply / Reset:

- `affected_users`
- `affected_employees`

Employee create/update/import/export:

- `purchase_control_role_id`

## Backwards compatibility

Existing Employees with no Purchase Role continue exactly as today.

Existing direct Employee template assignments render as **Direct override** and continue to work.

No migration guesses an Employee role.

No change to company-user role assignment UI/ACL semantics.

## Acceptance

1. Existing Employee without Purchase Role renders unchanged.
2. Add/Edit Employee can select or clear Purchase Role.
3. Same-company roles only are offered.
4. Helper copy makes clear Purchase Role is not permissions/login membership.
5. Inherited Employee control state shows the role and effective template.
6. Direct override is clearly distinguished and takes precedence.
7. Removing direct override reveals inherited role template.
8. Purchase Role changes do not imply current applied allowances changed.
9. Role assignment UI shows buyer + Employee counts.
10. Apply notices use backend-returned buyer + Employee affected counts.
11. Reset notices use backend-returned buyer + Employee affected counts.
12. Existing direct Employee Apply/Reset remains usable.
13. Existing Employee Edit / History / Deactivate workflows regress cleanly.
14. Existing buyer role purchase-control flows regress cleanly.
