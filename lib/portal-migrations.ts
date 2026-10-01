import { getLocalPostgres, hasLocalPostgres } from "@/lib/local-postgres";

export const PORTAL_MIGRATION_STAGES = [
  { value: "new", label: "New" },
  { value: "discovery", label: "Discovery" },
  { value: "data_prep", label: "Data preparation" },
  { value: "ready_to_import", label: "Ready to import" },
  { value: "imported", label: "Imported" },
  { value: "qa", label: "Internal QA" },
  { value: "customer_review", label: "Customer review" },
  { value: "ready_to_live", label: "Ready to live" },
  { value: "live", label: "Live" },
  { value: "paused", label: "Paused" },
] as const;

export type PortalMigrationStage = (typeof PORTAL_MIGRATION_STAGES)[number]["value"];

export const PORTAL_MIGRATION_TASK_STATUSES = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "complete", label: "Complete" },
  { value: "not_applicable", label: "Not applicable" },
] as const;

export type PortalMigrationTaskStatus = (typeof PORTAL_MIGRATION_TASK_STATUSES)[number]["value"];

export type PortalMigrationTaskDefinition = {
  key: string;
  label: string;
  description: string;
  toolHref?: string;
};

export const PORTAL_MIGRATION_TASKS: PortalMigrationTaskDefinition[] = [
  {
    key: "company_structure",
    label: "Company hierarchy",
    description: "Validate root and child company references, then apply the company structure.",
    toolHref: "/bulk-import",
  },
  {
    key: "company_products",
    label: "Company products",
    description: "Define the maximum SKU catalogue available to the company hierarchy.",
    toolHref: "/bulk-import?view=company-products",
  },
  {
    key: "roles_permissions",
    label: "Roles & permissions",
    description: "Create the company roles and confirm the required Fluid permission matrix.",
    toolHref: "/bulk-import?view=roles",
  },
  {
    key: "company_users",
    label: "Company users",
    description: "Create or update company memberships after the referenced roles exist.",
    toolHref: "/bulk-import?view=users",
  },
  {
    key: "role_products",
    label: "Role product restrictions",
    description: "Apply role-level SKU visibility where the portal needs a narrower catalogue.",
    toolHref: "/bulk-import?view=role-products",
  },
  {
    key: "purchase_controls",
    label: "Purchase controls",
    description: "Create purchase-control templates, SKU limits and role assignments where required.",
    toolHref: "/bulk-import?view=purchase-controls",
  },
  {
    key: "company_descriptions",
    label: "Company descriptions",
    description: "Import portal/company description content and confirm the presentation copy.",
    toolHref: "/bulk-import?view=company-descriptions",
  },
  {
    key: "personalisation",
    label: "Personalisation",
    description: "Confirm branding, representative presentation and any company-specific portal content.",
  },
  {
    key: "import_preview",
    label: "Import preview checked",
    description: "Review the dry-run results and resolve all errors before applying writes.",
  },
  {
    key: "import_applied",
    label: "Import applied",
    description: "Apply the reviewed import set and confirm the expected records were written.",
  },
  {
    key: "internal_qa",
    label: "Internal QA",
    description: "Check login, hierarchy, catalogue visibility, roles and purchasing behaviour.",
  },
  {
    key: "customer_qa",
    label: "Customer review",
    description: "Record customer/UAT approval or mark this step not applicable when no customer review is required.",
  },
  {
    key: "go_live",
    label: "Go-live",
    description: "Complete the final production check and record the portal as live.",
  },
];

export type PortalMigrationSummary = {
  id: number;
  name: string;
  root_company_ref: string;
  owner_name: string | null;
  stage: PortalMigrationStage;
  target_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  task_count: number;
  done_count: number;
  blocked_count: number;
  progress_percent: number;
  ready: boolean;
};

export type PortalMigrationTask = {
  migration_id: number;
  task_key: string;
  label: string;
  description: string;
  tool_href: string | null;
  sort_order: number;
  status: PortalMigrationTaskStatus;
  owner_name: string | null;
  note: string | null;
  completed_at: string | null;
  updated_at: string;
};

export type PortalMigrationEvent = {
  id: number;
  migration_id: number;
  event_type: string;
  message: string;
  actor_name: string | null;
  created_at: string;
};

export type PortalMigrationDetail = PortalMigrationSummary & {
  tasks: PortalMigrationTask[];
  events: PortalMigrationEvent[];
};

type MigrationRow = {
  id: number | string;
  name: string;
  root_company_ref: string;
  owner_name: string | null;
  stage: string;
  target_date: Date | string | null;
  notes: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  task_count?: number | string;
  done_count?: number | string;
  blocked_count?: number | string;
};

type TaskRow = {
  migration_id: number | string;
  task_key: string;
  label: string;
  description: string;
  tool_href: string | null;
  sort_order: number | string;
  status: string;
  owner_name: string | null;
  note: string | null;
  completed_at: Date | string | null;
  updated_at: Date | string;
};

type EventRow = {
  id: number | string;
  migration_id: number | string;
  event_type: string;
  message: string;
  actor_name: string | null;
  created_at: Date | string;
};

function iso(value: Date | string | null) {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function dateOnly(value: Date | string | null) {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export function isPortalMigrationStage(value: string): value is PortalMigrationStage {
  return PORTAL_MIGRATION_STAGES.some((stage) => stage.value === value);
}

export function isPortalMigrationTaskStatus(value: string): value is PortalMigrationTaskStatus {
  return PORTAL_MIGRATION_TASK_STATUSES.some((status) => status.value === value);
}

export function portalMigrationStageLabel(stage: PortalMigrationStage) {
  return PORTAL_MIGRATION_STAGES.find((item) => item.value === stage)?.label ?? stage;
}

export function portalMigrationTaskStatusLabel(status: PortalMigrationTaskStatus) {
  return PORTAL_MIGRATION_TASK_STATUSES.find((item) => item.value === status)?.label ?? status;
}

export function portalMigrationTaskDefinition(key: string) {
  return PORTAL_MIGRATION_TASKS.find((task) => task.key === key) ?? null;
}

function summaryFromRow(row: MigrationRow): PortalMigrationSummary {
  const taskCount = Number(row.task_count ?? PORTAL_MIGRATION_TASKS.length) || 0;
  const doneCount = Number(row.done_count ?? 0) || 0;
  const blockedCount = Number(row.blocked_count ?? 0) || 0;
  const progressPercent = taskCount ? Math.round((doneCount / taskCount) * 100) : 0;
  const stage = isPortalMigrationStage(row.stage) ? row.stage : "new";

  return {
    id: Number(row.id),
    name: row.name,
    root_company_ref: row.root_company_ref,
    owner_name: row.owner_name,
    stage,
    target_date: dateOnly(row.target_date),
    notes: row.notes,
    created_at: iso(row.created_at) ?? "",
    updated_at: iso(row.updated_at) ?? "",
    task_count: taskCount,
    done_count: doneCount,
    blocked_count: blockedCount,
    progress_percent: progressPercent,
    ready: taskCount > 0 && doneCount === taskCount && blockedCount === 0,
  };
}

function taskFromRow(row: TaskRow): PortalMigrationTask {
  const status = isPortalMigrationTaskStatus(row.status) ? row.status : "not_started";
  return {
    migration_id: Number(row.migration_id),
    task_key: row.task_key,
    label: row.label,
    description: row.description,
    tool_href: row.tool_href,
    sort_order: Number(row.sort_order) || 0,
    status,
    owner_name: row.owner_name,
    note: row.note,
    completed_at: iso(row.completed_at),
    updated_at: iso(row.updated_at) ?? "",
  };
}

function eventFromRow(row: EventRow): PortalMigrationEvent {
  return {
    id: Number(row.id),
    migration_id: Number(row.migration_id),
    event_type: row.event_type,
    message: row.message,
    actor_name: row.actor_name,
    created_at: iso(row.created_at) ?? "",
  };
}

export function isPortalMigrationStoreConfigured() {
  return hasLocalPostgres();
}

function requirePortalMigrationStore() {
  if (!hasLocalPostgres()) {
    throw new Error("Portal migration tracking requires CSS_ADMIN_DATABASE_URL.");
  }
  return getLocalPostgres();
}

export async function listPortalMigrations(): Promise<PortalMigrationSummary[]> {
  const sql = requirePortalMigrationStore();
  const rows = await sql`
    SELECT
      m.id,
      m.name,
      m.root_company_ref,
      m.owner_name,
      m.stage,
      m.target_date,
      m.notes,
      m.created_at,
      m.updated_at,
      COUNT(t.migration_id)::int AS task_count,
      COUNT(t.migration_id) FILTER (WHERE t.status IN ('complete', 'not_applicable'))::int AS done_count,
      COUNT(t.migration_id) FILTER (WHERE t.status = 'blocked')::int AS blocked_count
    FROM css_admin.portal_migration m
    LEFT JOIN css_admin.portal_migration_task t
      ON t.migration_id = m.id
    GROUP BY m.id
    ORDER BY
      CASE WHEN m.stage = 'live' THEN 1 ELSE 0 END,
      m.target_date NULLS LAST,
      m.updated_at DESC
  `;

  return rows.map((row) => summaryFromRow(row as MigrationRow));
}

export async function getPortalMigration(id: number): Promise<PortalMigrationDetail | null> {
  const sql = requirePortalMigrationStore();
  const migrationRows = await sql`
    SELECT
      m.id,
      m.name,
      m.root_company_ref,
      m.owner_name,
      m.stage,
      m.target_date,
      m.notes,
      m.created_at,
      m.updated_at,
      COUNT(t.migration_id)::int AS task_count,
      COUNT(t.migration_id) FILTER (WHERE t.status IN ('complete', 'not_applicable'))::int AS done_count,
      COUNT(t.migration_id) FILTER (WHERE t.status = 'blocked')::int AS blocked_count
    FROM css_admin.portal_migration m
    LEFT JOIN css_admin.portal_migration_task t
      ON t.migration_id = m.id
    WHERE m.id = ${id}
    GROUP BY m.id
    LIMIT 1
  `;

  if (!migrationRows[0]) return null;

  const [taskRows, eventRows] = await Promise.all([
    sql`
      SELECT
        migration_id,
        task_key,
        label,
        description,
        tool_href,
        sort_order,
        status,
        owner_name,
        note,
        completed_at,
        updated_at
      FROM css_admin.portal_migration_task
      WHERE migration_id = ${id}
      ORDER BY sort_order, task_key
    `,
    sql`
      SELECT id, migration_id, event_type, message, actor_name, created_at
      FROM css_admin.portal_migration_event
      WHERE migration_id = ${id}
      ORDER BY created_at DESC, id DESC
      LIMIT 100
    `,
  ]);

  return {
    ...summaryFromRow(migrationRows[0] as MigrationRow),
    tasks: taskRows.map((row) => taskFromRow(row as TaskRow)),
    events: eventRows.map((row) => eventFromRow(row as EventRow)),
  };
}

function requiredText(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function optionalText(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function optionalDate(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error("Target date must use YYYY-MM-DD.");
  }
  return normalized;
}

export async function createPortalMigration(input: {
  name: string;
  rootCompanyRef: string;
  ownerName?: string | null;
  targetDate?: string | null;
  notes?: string | null;
  actorName?: string | null;
}) {
  const sql = requirePortalMigrationStore();
  const name = requiredText(input.name, "Portal name");
  const rootCompanyRef = requiredText(input.rootCompanyRef, "Root company reference").toUpperCase();
  const ownerName = optionalText(input.ownerName);
  const targetDate = optionalDate(input.targetDate);
  const notes = optionalText(input.notes);
  const actorName = optionalText(input.actorName) ?? "CSS Admin";

  return sql.begin(async (tx) => {
    const rows = await tx`
      INSERT INTO css_admin.portal_migration (
        name,
        root_company_ref,
        owner_name,
        stage,
        target_date,
        notes,
        created_at,
        updated_at
      ) VALUES (
        ${name},
        ${rootCompanyRef},
        ${ownerName},
        'new',
        ${targetDate},
        ${notes},
        now(),
        now()
      )
      RETURNING id
    `;

    const migrationId = Number(rows[0].id);

    for (const [index, task] of PORTAL_MIGRATION_TASKS.entries()) {
      await tx`
        INSERT INTO css_admin.portal_migration_task (
          migration_id,
          task_key,
          label,
          description,
          tool_href,
          sort_order,
          status,
          updated_at
        ) VALUES (
          ${migrationId},
          ${task.key},
          ${task.label},
          ${task.description},
          ${task.toolHref ?? null},
          ${index + 1},
          'not_started',
          now()
        )
      `;
    }

    await tx`
      INSERT INTO css_admin.portal_migration_event (
        migration_id,
        event_type,
        message,
        actor_name
      ) VALUES (
        ${migrationId},
        'created',
        ${`Migration created for ${rootCompanyRef}.`},
        ${actorName}
      )
    `;

    return migrationId;
  });
}

export async function updatePortalMigration(input: {
  id: number;
  ownerName?: string | null;
  stage: string;
  targetDate?: string | null;
  notes?: string | null;
  actorName?: string | null;
}) {
  if (!Number.isInteger(input.id) || input.id <= 0) throw new Error("Invalid migration id.");
  if (!isPortalMigrationStage(input.stage)) throw new Error("Invalid migration stage.");

  const sql = requirePortalMigrationStore();
  const ownerName = optionalText(input.ownerName);
  const targetDate = optionalDate(input.targetDate);
  const notes = optionalText(input.notes);
  const actorName = optionalText(input.actorName) ?? "CSS Admin";

  await sql.begin(async (tx) => {
    const rows = await tx`
      UPDATE css_admin.portal_migration
      SET
        owner_name = ${ownerName},
        stage = ${input.stage},
        target_date = ${targetDate},
        notes = ${notes},
        updated_at = now()
      WHERE id = ${input.id}
      RETURNING id
    `;

    if (!rows[0]) throw new Error("Migration not found.");

    await tx`
      INSERT INTO css_admin.portal_migration_event (
        migration_id,
        event_type,
        message,
        actor_name
      ) VALUES (
        ${input.id},
        'migration_updated',
        ${`Migration details updated. Stage: ${portalMigrationStageLabel(input.stage)}.`},
        ${actorName}
      )
    `;
  });
}

export async function updatePortalMigrationTask(input: {
  migrationId: number;
  taskKey: string;
  status: string;
  ownerName?: string | null;
  note?: string | null;
  actorName?: string | null;
}) {
  if (!Number.isInteger(input.migrationId) || input.migrationId <= 0) {
    throw new Error("Invalid migration id.");
  }
  if (!isPortalMigrationTaskStatus(input.status)) throw new Error("Invalid task status.");

  const definition = portalMigrationTaskDefinition(input.taskKey);
  if (!definition) throw new Error("Unknown migration task.");

  const sql = requirePortalMigrationStore();
  const ownerName = optionalText(input.ownerName);
  const note = optionalText(input.note);
  const actorName = optionalText(input.actorName) ?? "CSS Admin";

  await sql.begin(async (tx) => {
    const rows = await tx`
      UPDATE css_admin.portal_migration_task
      SET
        status = ${input.status},
        owner_name = ${ownerName},
        note = ${note},
        completed_at = CASE
          WHEN ${input.status} IN ('complete', 'not_applicable')
            THEN COALESCE(completed_at, now())
          ELSE NULL
        END,
        updated_at = now()
      WHERE migration_id = ${input.migrationId}
        AND task_key = ${input.taskKey}
      RETURNING migration_id
    `;

    if (!rows[0]) throw new Error("Migration task not found.");

    await tx`
      UPDATE css_admin.portal_migration
      SET updated_at = now()
      WHERE id = ${input.migrationId}
    `;

    await tx`
      INSERT INTO css_admin.portal_migration_event (
        migration_id,
        event_type,
        message,
        actor_name
      ) VALUES (
        ${input.migrationId},
        'task_updated',
        ${`${definition.label} marked ${portalMigrationTaskStatusLabel(input.status)}.`},
        ${actorName}
      )
    `;
  });
}
