import Link from "next/link";
import { currentStaffJobIdentity } from "@/lib/admin-job-auth";
import { hasExportJobStore, listOwnerExportJobs } from "@/lib/admin-export-jobs";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import { AdminJobsAutoRefresh } from "@/components/admin-jobs-auto-refresh";
import { cancelQueuedExportAction, markExportJobsReadAction } from "./actions";

function timestamp(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/London", timeZoneName: "short",
  }).format(date) : "—";
}
function statusLabel(status: string) {
  return ({
    queued: "Queued", running: "Running", ready: "Ready",
    failed: "Failed", cancelled: "Cancelled", expired: "Expired",
  } as Record<string, string>)[status] ?? status;
}

export default async function ExportJobsPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const notice = params.queued === "1";
  const errorParam = typeof params.error === "string" ? params.error.slice(0, 180) : null;
  if (!hasExportJobStore()) {
    return (
      <div className="stack">
        <header className="page-header"><div><p className="eyebrow">Background operations</p><h1>Export jobs</h1></div></header>
        <div className="card stack">
          <h2>Background export queue is not configured</h2>
          <p className="muted">Exports can still be downloaded directly. An administrator needs to enable PostgreSQL job storage and the dedicated worker.</p>
          <Link href="/companies">Return to companies</Link>
        </div>
      </div>
    );
  }

  let jobs;
  try {
    const actor = await currentStaffJobIdentity();
    jobs = await listOwnerExportJobs(actor.user_id);
  } catch (error) {
    return (
      <div className="card stack">
        <h1>Export jobs unavailable</h1>
        <p className="muted">{graphQLErrorMessage(error)}</p>
      </div>
    );
  }
  const active = jobs.some(job => job.status === "queued" || job.status === "running");
  const unread = jobs.some(job => job.downloadable && !job.acknowledged_at);

  return (
    <div className="stack section-gap admin-export-jobs-page">
      <AdminJobsAutoRefresh active={active} />
      <header className="page-header">
        <div>
          <p className="eyebrow">Background operations</p>
          <h1>Export jobs</h1>
          <p className="muted">You can leave this page while exports run. Finished files remain available for seven days.</p>
        </div>
        <div className="button-row">
          {unread ? (
            <form action={markExportJobsReadAction}>
              <button className="button button-secondary button-compact" type="submit">Mark notifications read</button>
            </form>
          ) : null}
          <Link className="button button-secondary button-link button-compact" href="/jobs">Refresh</Link>
        </div>
      </header>

      {notice ? <div className="notice" role="status">Export queued. We’ll let you know when the workbook is ready.</div> : null}
      {errorParam ? <div className="error" role="alert">{errorParam}</div> : null}

      {jobs.length === 0 ? (
        <div className="card stack">
          <h2>No export jobs yet</h2>
          <p className="muted">Open a company structure and select Queue background export to create your first job.</p>
          <Link href="/companies">Browse companies</Link>
        </div>
      ) : (
        <div className="stack">
          {jobs.map(job => {
            const ready = job.downloadable;
            const percent = job.total_companies > 0
              ? Math.round(100 * job.completed_companies / job.total_companies) : 0;
            return (
              <article key={job.id} className="card admin-export-job">
                <div className="admin-export-job-main">
                  <div className="admin-export-job-title">
                    <div>
                      <p className="eyebrow">Company structure · Products only</p>
                      <h2>{job.root_reference} — {job.root_name}</h2>
                      <p className="muted small-text">Requested {timestamp(job.created_at)} · {job.total_companies} companies</p>
                    </div>
                    <span className={"badge " + (ready ? "badge-ok" :
                      job.status === "failed" ? "badge-restricted" : "badge-neutral")}>
                      {job.status === "ready" && !ready ? "Expired" : statusLabel(job.status)}
                    </span>
                  </div>
                  {job.status === "running" || job.status === "queued" ? (
                    <div className="stack admin-export-job-progress">
                      <div className="admin-export-job-progress-info">
                        <span>{job.status === "queued" ? "Waiting for worker" :
                          job.completed_companies + " of " + job.total_companies + " companies processed"}</span>
                        <span>{percent}%</span>
                      </div>
                      <progress value={job.completed_companies} max={job.total_companies} aria-label="Export progress" />
                    </div>
                  ) : null}
                  {ready ? <p className="muted small-text">Finished {timestamp(job.finished_at)} · Expires {timestamp(job.expires_at)}</p> : null}
                  {job.status === "failed" && job.error_message ?
                    <p className="error small-text">{job.error_message}</p> : null}
                </div>
                <div className="admin-export-job-actions">
                  {ready ? (
                    <a className="button button-link button-compact" href={"/api/admin/jobs/" + job.id + "/download"}>
                      Download Excel
                    </a>
                  ) : null}
                  {job.status === "queued" ? (
                    <form action={cancelQueuedExportAction}>
                      <input type="hidden" name="jobId" value={job.id} />
                      <button className="button button-secondary button-compact" type="submit">Cancel</button>
                    </form>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
