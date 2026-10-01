import Link from "next/link";
import { createPortalMigrationAction } from "@/app/(admin)/migrations/actions";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import {
  getActiveMagentoAdmins,
  magentoAdminDisplayName,
  type MagentoAdminUser,
} from "@/lib/graphql/admin-users";
import {
  isPortalMigrationStage,
  isPortalMigrationStoreConfigured,
  listPortalMigrations,
  portalMigrationStageLabel,
  PORTAL_MIGRATION_STAGES,
  type PortalMigrationSummary,
} from "@/lib/portal-migrations";
import styles from "@/app/(admin)/migrations/migrations.module.css";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
}

function stageBadgeClass(migration: PortalMigrationSummary) {
  if (migration.blocked_count > 0) return "badge-restricted";
  if (migration.stage === "live") return "badge-ok";
  return "badge-neutral";
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

function matchesSearch(migration: PortalMigrationSummary, query: string) {
  if (!query) return true;
  const haystack = [
    migration.name,
    migration.root_company_ref,
    migration.owner_name ?? "",
    portalMigrationStageLabel(migration.stage),
  ].join(" ").toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export default async function PortalMigrationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const search = first(query.q)?.trim() ?? "";
  const requestedStage = first(query.stage)?.trim() ?? "";
  const owner = first(query.owner)?.trim() ?? "";
  const ownerAdminUserId = owner ? Number(owner) : null;
  const blockedOnly = first(query.blocked) === "1";
  const notice = first(query.notice);
  const errorFromAction = first(query.error);

  if (!isPortalMigrationStoreConfigured()) {
    return (
      <div className="stack section-gap">
        <header className="page-header">
          <div>
            <p className="eyebrow">Staff migration workspace</p>
            <h1>Portal migrations</h1>
            <p className="muted">Track each OGL / Tower portal migration from preparation through go-live.</p>
          </div>
        </header>
        <section className="card stack">
          <h2>Migration storage is not configured</h2>
          <p className="muted">
            This staff-only workspace uses the same local Postgres connection as Admin Finance. Configure CSS_ADMIN_DATABASE_URL and apply the portal migration schema before using it.
          </p>
        </section>
      </div>
    );
  }

  let migrations: PortalMigrationSummary[] = [];
  let loadError: string | null = null;
  try {
    migrations = await listPortalMigrations();
  } catch (caught) {
    loadError = caught instanceof Error ? caught.message : "Portal migrations could not be loaded.";
  }

  if (loadError) {
    return (
      <div className="stack section-gap">
        <header className="page-header">
          <div>
            <p className="eyebrow">Staff migration workspace</p>
            <h1>Portal migrations</h1>
            <p className="muted">Track each OGL / Tower portal migration from preparation through go-live.</p>
          </div>
        </header>
        <div className="error">{loadError}</div>
      </div>
    );
  }

  const { admins, error: adminOwnersError } = await loadAdminOwners();

  const stageFilter = isPortalMigrationStage(requestedStage) ? requestedStage : "";
  const filtered = migrations.filter((migration) => (
    matchesSearch(migration, search)
    && (!stageFilter || migration.stage === stageFilter)
    && (
      ownerAdminUserId === null
      || (Number.isInteger(ownerAdminUserId) && migration.owner_admin_user_id === ownerAdminUserId)
    )
    && (!blockedOnly || migration.blocked_count > 0)
  ));

  const liveCount = migrations.filter((migration) => migration.stage === "live").length;
  const blockedCount = migrations.filter((migration) => migration.blocked_count > 0).length;
  const readyCount = migrations.filter((migration) => migration.ready && migration.stage !== "live").length;

  return (
    <div className="stack section-gap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Staff migration workspace</p>
          <h1>Portal migrations</h1>
          <p className="muted">
            One record per portal/company hierarchy. Track ownership, blockers, readiness and the standard migration checklist.
          </p>
        </div>
        <Link className="button button-secondary button-link" href="/help?category=Portal+migration">
          Migration how-to
        </Link>
      </header>

      {notice ? <div className="notice">{notice}</div> : null}
      {errorFromAction ? <div className="error">{errorFromAction}</div> : null}
      {adminOwnersError ? (
        <div className="error">Magento Admin owners are unavailable: {adminOwnersError}</div>
      ) : null}

      <section className={styles.summaryGrid} aria-label="Migration summary">
        <div className={styles.summaryCard}>
          <span className={styles.summaryValue}>{migrations.length}</span>
          <span className={styles.summaryLabel}>Total portal migrations</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryValue}>{migrations.length - liveCount}</span>
          <span className={styles.summaryLabel}>Active migrations</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryValue}>{blockedCount}</span>
          <span className={styles.summaryLabel}>Blocked migrations</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryValue}>{readyCount}</span>
          <span className={styles.summaryLabel}>Checklist ready, not live</span>
        </div>
      </section>

      <details className={`card ${styles.createPanel}`}>
        <summary>Create portal migration</summary>
        <form action={createPortalMigrationAction} className={styles.createBody}>
          <div className={styles.createGrid}>
            <div className="field">
              <label htmlFor="migration-name">Portal / customer name</label>
              <input id="migration-name" name="name" type="text" required placeholder="BJF Portal" />
            </div>
            <div className="field">
              <label htmlFor="migration-root-ref">Root OGL company reference</label>
              <input id="migration-root-ref" name="rootCompanyRef" type="text" required placeholder="BR1024" />
            </div>
            <div className="field">
              <label htmlFor="migration-owner">Owner</label>
              <select id="migration-owner" name="ownerAdminUserId" defaultValue="" disabled={Boolean(adminOwnersError)}>
                <option value="">Unassigned</option>
                {admins.map((admin) => (
                  <option value={admin.user_id} key={admin.user_id}>{adminOptionLabel(admin)}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="migration-target">Target go-live</label>
              <input id="migration-target" name="targetDate" type="date" />
            </div>
            <div className={`field ${styles.span4}`}>
              <label htmlFor="migration-notes">Notes</label>
              <textarea id="migration-notes" name="notes" rows={3} placeholder="Scope, customer contacts, special requirements or known risks." />
            </div>
          </div>
          <div className="button-row">
            <button className="button" type="submit" disabled={Boolean(adminOwnersError)}>Create migration</button>
            <span className="muted small-text">The standard portal checklist is created automatically.</span>
          </div>
        </form>
      </details>

      <section className={`card ${styles.toolbar}`}>
        <div>
          <h2>Migration queue</h2>
          <p className="muted">Filter the 300+ portal programme without turning it into a second Jira.</p>
        </div>
        <form method="get" className={styles.filterGrid}>
          <div className="field">
            <label htmlFor="migration-search">Search</label>
            <input id="migration-search" name="q" type="search" defaultValue={search} placeholder="Portal, company ref or owner" />
          </div>
          <div className="field">
            <label htmlFor="migration-stage">Stage</label>
            <select id="migration-stage" name="stage" defaultValue={stageFilter}>
              <option value="">All stages</option>
              {PORTAL_MIGRATION_STAGES.map((stage) => (
                <option value={stage.value} key={stage.value}>{stage.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="migration-owner-filter">Owner</label>
            <select id="migration-owner-filter" name="owner" defaultValue={owner} disabled={Boolean(adminOwnersError)}>
              <option value="">All owners</option>
              {admins.map((admin) => (
                <option value={admin.user_id} key={admin.user_id}>{adminOptionLabel(admin)}</option>
              ))}
            </select>
          </div>
          <label className="check-field">
            <input name="blocked" type="checkbox" value="1" defaultChecked={blockedOnly} />
            <span><strong>Blocked only</strong><small className="muted">Show migrations with at least one blocked checklist item.</small></span>
          </label>
          <div className={styles.filterActions}>
            <button className="button button-compact" type="submit">Apply filters</button>
            <Link className="button button-secondary button-link button-compact" href="/migrations">Reset</Link>
            <span className="muted small-text">{filtered.length} of {migrations.length} shown</span>
          </div>
        </form>
      </section>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Portal</th>
              <th>Owner</th>
              <th>Stage</th>
              <th>Progress</th>
              <th>Blockers</th>
              <th>Target</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((migration) => (
              <tr key={migration.id}>
                <td>
                  <div className={styles.portalCell}>
                    <Link className="row-link" href={`/migrations/${migration.id}`}>{migration.name}</Link>
                    <span className={styles.portalRef}>{migration.root_company_ref}</span>
                  </div>
                </td>
                <td>{migration.owner_name || "Unassigned"}</td>
                <td><span className={`badge ${stageBadgeClass(migration)}`}>{portalMigrationStageLabel(migration.stage)}</span></td>
                <td className={styles.progressCell}>
                  <div className={styles.progressMeta}>
                    <span>{migration.progress_percent}%</span>
                    <span>{migration.done_count}/{migration.task_count}</span>
                  </div>
                  <div className={styles.progressTrack} aria-label={`${migration.progress_percent}% complete`}>
                    <span
                      className={`${styles.progressBar} ${migration.ready ? styles.progressBarReady : ""}`}
                      style={{ width: `${migration.progress_percent}%` }}
                    />
                  </div>
                </td>
                <td>
                  {migration.blocked_count ? (
                    <span className="badge badge-restricted">{migration.blocked_count} blocked</span>
                  ) : (
                    <span className="badge badge-neutral">None</span>
                  )}
                </td>
                <td>{formatDate(migration.target_date)}</td>
                <td>{formatDateTime(migration.updated_at)}</td>
              </tr>
            ))}
            {!filtered.length ? (
              <tr>
                <td colSpan={7}><span className="muted">No migrations match the current filters.</span></td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
