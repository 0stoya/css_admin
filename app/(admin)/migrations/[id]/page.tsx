import Link from "next/link";
import { notFound } from "next/navigation";
import {
  updatePortalMigrationAction,
  updatePortalMigrationTaskAction,
} from "@/app/(admin)/migrations/actions";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import {
  getActiveMagentoAdmins,
  magentoAdminDisplayName,
  type MagentoAdminUser,
} from "@/lib/graphql/admin-users";
import {
  getPortalMigration,
  isPortalMigrationStoreConfigured,
  portalMigrationStageLabel,
  portalMigrationTaskStatusLabel,
  PORTAL_MIGRATION_STAGES,
  PORTAL_MIGRATION_TASK_STATUSES,
  type PortalMigrationTask,
} from "@/lib/portal-migrations";
import styles from "@/app/(admin)/migrations/migrations.module.css";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function adminOptionLabel(admin: MagentoAdminUser) {
  const name = magentoAdminDisplayName(admin);
  return admin.username && admin.username !== name
    ? `${name} (@${admin.username})`
    : name;
}

async function loadAdminOwners() {
  try {
    return { admins: await getActiveMagentoAdmins(), error: null };
  } catch (error) {
    return {
      admins: [] as MagentoAdminUser[],
      error: graphQLErrorMessage(error),
    };
  }
}

function taskBadgeClass(task: PortalMigrationTask) {
  if (task.status === "blocked") return "badge-restricted";
  if (task.status === "complete") return "badge-ok";
  return "badge-neutral";
}

function taskCardClass(task: PortalMigrationTask) {
  if (task.status === "blocked") return `${styles.taskCard} ${styles.taskBlocked}`;
  if (task.status === "complete" || task.status === "not_applicable") {
    return `${styles.taskCard} ${styles.taskDone}`;
  }
  return styles.taskCard;
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function PortalMigrationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id: rawId } = await params;
  const query = await searchParams;
  const migrationId = Number(rawId);
  const notice = first(query.notice);
  const actionError = first(query.error);

  if (!Number.isInteger(migrationId) || migrationId <= 0) notFound();

  if (!isPortalMigrationStoreConfigured()) {
    return (
      <section className="card stack">
        <h1>Portal migration storage unavailable</h1>
        <p className="muted">CSS_ADMIN_DATABASE_URL is required for the staff migration tracker.</p>
        <Link className="back-link" href="/migrations">Back to migrations</Link>
      </section>
    );
  }

  let migration;
  try {
    migration = await getPortalMigration(migrationId);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Portal migration could not be loaded.";
    return (
      <div className="stack">
        <Link className="back-link" href="/migrations">← Portal migrations</Link>
        <div className="error">{message}</div>
      </div>
    );
  }

  if (!migration) notFound();

  const { admins, error: adminOwnersError } = await loadAdminOwners();
  const incomplete = migration.tasks.filter(
    (task) => task.status !== "complete" && task.status !== "not_applicable",
  );
  const sequentialStages = PORTAL_MIGRATION_STAGES.filter((stage) => stage.value !== "paused");

  return (
    <div className="stack section-gap">
      <div className="breadcrumbs">
        <Link href="/migrations">Portal migrations</Link>
        <span>/</span>
        <span>{migration.name}</span>
      </div>

      <header className="page-header">
        <div>
          <p className="eyebrow">Portal migration · {migration.root_company_ref}</p>
          <h1>{migration.name}</h1>
          <p className="muted">
            {migration.owner_name ? `Owned by ${migration.owner_name}` : "Unassigned"} · {portalMigrationStageLabel(migration.stage)}
          </p>
        </div>
        <div className="button-row">
          <Link className="button button-secondary button-link" href="/help?category=Portal+migration">How-to</Link>
          <Link className="button button-secondary button-link" href="/migrations">Back to queue</Link>
        </div>
      </header>

      {notice ? <div className="notice">{notice}</div> : null}
      {actionError ? <div className="error">{actionError}</div> : null}
      {adminOwnersError ? <div className="error">Magento Admin owners are unavailable: {adminOwnersError}</div> : null}

      <section className="card stack">
        <div className="section-heading">
          <div>
            <h2>Migration path</h2>
            <p className="muted">Stage is a programme view; checklist progress below is the actual readiness signal.</p>
          </div>
          {migration.stage === "paused" ? <span className="badge badge-restricted">Paused</span> : null}
        </div>
        <div className={styles.stageFlow} aria-label="Migration stages">
          {sequentialStages.map((stage) => (
            <span
              className={`${styles.stageStep} ${migration.stage === stage.value ? styles.stageCurrent : ""}`}
              key={stage.value}
            >
              {stage.label}
            </span>
          ))}
        </div>
      </section>

      <div className={styles.detailLayout}>
        <div className="stack">
          <section className="card stack">
            <div>
              <p className="eyebrow">Programme control</p>
              <h2>Migration details</h2>
            </div>
            <form action={updatePortalMigrationAction} className="stack">
              <input name="migrationId" type="hidden" value={migration.id} />
              <div className={styles.metadataGrid}>
                <div className="field">
                  <label htmlFor="migration-owner">Owner</label>
                  <select
                    id="migration-owner"
                    name="ownerAdminUserId"
                    defaultValue={migration.owner_admin_user_id ? String(migration.owner_admin_user_id) : ""}
                    disabled={Boolean(adminOwnersError)}
                  >
                    <option value="">Unassigned</option>
                    {migration.owner_admin_user_id
                      && !admins.some((admin) => admin.user_id === migration.owner_admin_user_id)
                      ? <option value={migration.owner_admin_user_id}>{migration.owner_name ?? `Admin #${migration.owner_admin_user_id}`} (inactive/unavailable)</option>
                      : null}
                    {admins.map((admin) => (
                      <option value={admin.user_id} key={admin.user_id}>{adminOptionLabel(admin)}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="migration-stage">Stage</label>
                  <select id="migration-stage" name="stage" defaultValue={migration.stage}>
                    {PORTAL_MIGRATION_STAGES.map((stage) => (
                      <option value={stage.value} key={stage.value}>{stage.label}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="migration-target">Target go-live</label>
                  <input id="migration-target" name="targetDate" type="date" defaultValue={migration.target_date ?? ""} />
                </div>
                <div className={`field ${styles.span4}`}>
                  <label htmlFor="migration-notes">Notes</label>
                  <textarea id="migration-notes" name="notes" rows={3} defaultValue={migration.notes ?? ""} placeholder="Scope, customer contacts, risks or migration notes." />
                </div>
              </div>
              <div className="button-row">
                <button className="button" type="submit" disabled={Boolean(adminOwnersError)}>Save migration details</button>
                <span className="muted small-text">Last updated {formatDateTime(migration.updated_at)}</span>
              </div>
            </form>
          </section>

          <section className="stack">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Working checklist</p>
                <h2>Portal readiness</h2>
                <p className="muted">Use Not applicable for a genuine non-requirement; it counts as resolved without pretending work happened.</p>
              </div>
              <span className={`badge ${migration.blocked_count ? "badge-restricted" : migration.ready ? "badge-ok" : "badge-neutral"}`}>
                {migration.blocked_count ? `${migration.blocked_count} blocked` : migration.ready ? "Ready" : `${incomplete.length} remaining`}
              </span>
            </div>

            <div className={styles.taskList}>
              {migration.tasks.map((task, index) => {
                const statusId = `task-${task.task_key}-status`;
                const ownerId = `task-${task.task_key}-owner`;
                const noteId = `task-${task.task_key}-note`;
                return (
                  <article className={taskCardClass(task)} key={task.task_key}>
                    <div className={styles.taskHeader}>
                      <div className={styles.taskTitle}>
                        <p className="eyebrow">Step {index + 1}</p>
                        <h3>{task.label}</h3>
                        <p>{task.description}</p>
                      </div>
                      <span className={`badge ${taskBadgeClass(task)}`}>{portalMigrationTaskStatusLabel(task.status)}</span>
                    </div>

                    {task.tool_href ? (
                      <Link className={styles.taskTool} href={task.tool_href}>
                        Open the relevant Admin tool →
                      </Link>
                    ) : null}

                    <form action={updatePortalMigrationTaskAction} className={styles.taskForm}>
                      <input name="migrationId" type="hidden" value={migration.id} />
                      <input name="taskKey" type="hidden" value={task.task_key} />

                      <div className="field">
                        <label htmlFor={statusId}>Status</label>
                        <select id={statusId} name="status" defaultValue={task.status}>
                          {PORTAL_MIGRATION_TASK_STATUSES.map((status) => (
                            <option value={status.value} key={status.value}>{status.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label htmlFor={ownerId}>Owner</label>
                        <select
                          id={ownerId}
                          name="ownerAdminUserId"
                          defaultValue={task.owner_admin_user_id ? String(task.owner_admin_user_id) : ""}
                          disabled={Boolean(adminOwnersError)}
                        >
                          <option value="">Use migration owner / unassigned</option>
                          {task.owner_admin_user_id
                            && !admins.some((admin) => admin.user_id === task.owner_admin_user_id)
                            ? <option value={task.owner_admin_user_id}>{task.owner_name ?? `Admin #${task.owner_admin_user_id}`} (inactive/unavailable)</option>
                            : null}
                          {admins.map((admin) => (
                            <option value={admin.user_id} key={admin.user_id}>{adminOptionLabel(admin)}</option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label htmlFor={noteId}>Note / blocker</label>
                        <input id={noteId} name="note" type="text" defaultValue={task.note ?? ""} placeholder="What changed, or what is blocking this step?" />
                      </div>

                      <button className="button button-compact" type="submit" disabled={Boolean(adminOwnersError)}>Save</button>
                    </form>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="stack">
          <section className={`card ${styles.readiness}`}>
            <div className={styles.readinessHeadline}>
              <div>
                <p className="eyebrow">Readiness</p>
                <span className={styles.readinessValue}>{migration.progress_percent}%</span>
              </div>
              <span className={`badge ${migration.ready ? "badge-ok" : migration.blocked_count ? "badge-restricted" : "badge-neutral"}`}>
                {migration.ready ? "Checklist ready" : migration.blocked_count ? "Action required" : "In progress"}
              </span>
            </div>
            <div className={styles.progressTrack} aria-label={`${migration.progress_percent}% complete`}>
              <span
                className={`${styles.progressBar} ${migration.ready ? styles.progressBarReady : ""}`}
                style={{ width: `${migration.progress_percent}%` }}
              />
            </div>
            <p className="muted">
              {migration.done_count} of {migration.task_count} steps resolved.
              {migration.blocked_count ? ` ${migration.blocked_count} currently blocked.` : ""}
            </p>
            {incomplete.length ? (
              <ul className={styles.readinessList}>
                {incomplete.slice(0, 6).map((task) => (
                  <li key={task.task_key}>{task.label} — {portalMigrationTaskStatusLabel(task.status)}</li>
                ))}
                {incomplete.length > 6 ? <li>+ {incomplete.length - 6} more</li> : null}
              </ul>
            ) : (
              <div className="notice">All checklist items are resolved. The migration can be moved through the final stage/go-live decision.</div>
            )}
          </section>

          <section className="card stack">
            <div>
              <p className="eyebrow">Audit trail</p>
              <h2>Recent activity</h2>
            </div>
            {migration.events.length ? (
              <ol className={styles.eventList}>
                {migration.events.map((event) => (
                  <li className={styles.eventItem} key={event.id}>
                    <strong>{event.message}</strong>
                    <span className={styles.eventMeta}>{event.actor_name ?? "CSS Admin"} · {formatDateTime(event.created_at)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">No activity recorded yet.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
