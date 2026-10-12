"use client";

import Link from "next/link";
import { Bell, CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Notification = { id: string; label: string; finished_at: string };
type Feed = { ready: Notification[]; count: number };

export function AdminExportJobBell() {
  const [count, setCount] = useState(0);
  const [recent, setRecent] = useState<Notification | null>(null);
  const known = useRef<Set<string> | null>(null);

  useEffect(() => {
    let active = true;
    async function refresh() {
      if (document.visibilityState === "hidden") return;
      try {
        const response = await fetch("/api/admin/jobs/notifications", {
          credentials: "same-origin", cache: "no-store",
        });
        if (!response.ok) return;
        const feed = await response.json() as Feed;
        if (!active) return;
        if (known.current) {
          const newlyReady = feed.ready.find(job => !known.current!.has(job.id));
          if (newlyReady) setRecent(newlyReady);
        }
        known.current = new Set(feed.ready.map(job => job.id));
        setCount(feed.count);
      } catch {
        // Poll errors never interrupt Staff navigation or export processing.
      }
    }
    void refresh();
    const interval = window.setInterval(() => void refresh(), 30000);
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);

  return (
    <div className="admin-export-notification">
      <Link className="admin-export-bell" href="/jobs"
        aria-label={count ? "Export jobs: " + count + " ready to download" : "Export jobs"}
        title="Export jobs">
        <Bell size={19} aria-hidden="true" />
        <span className="admin-export-bell-label">Jobs</span>
        {count > 0 ? <span className="admin-export-bell-count">{count > 20 ? "20+" : count}</span> : null}
      </Link>
      {recent ? (
        <div className="admin-export-ready-toast" role="status" aria-live="polite">
          <CheckCircle2 size={18} aria-hidden="true" />
          <span>Your {recent.label} export is ready.</span>
          <Link href="/jobs" onClick={() => setRecent(null)}>View jobs</Link>
          <button type="button" aria-label="Dismiss export notification"
            onClick={() => setRecent(null)}>×</button>
        </div>
      ) : null}
    </div>
  );
}
