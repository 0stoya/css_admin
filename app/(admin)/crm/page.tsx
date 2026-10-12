import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, ClipboardList } from "lucide-react";

export const metadata: Metadata = { title: "CRM" };

export default function AdminCrmPage() {
  return (
    <div className="stack section-gap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Company operations</p>
          <h1>CRM</h1>
          <p className="muted">
            Manage company onboarding and find the guides used by your team.
          </p>
        </div>
      </header>

      <div className="grid">
        <section className="card stack" aria-labelledby="crm-migrations-title">
          <ClipboardList size={26} color="var(--css-primary)" aria-hidden="true" />
          <div>
            <h2 id="crm-migrations-title">Migrations</h2>
            <p className="muted">
              Review Portal onboarding requests and migration progress.
            </p>
          </div>
          <div>
            <Link href="/migrations" className="button button-secondary button-link">
              Open migrations <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section className="card stack" aria-labelledby="crm-help-title">
          <BookOpen size={26} color="var(--css-primary)" aria-hidden="true" />
          <div>
            <h2 id="crm-help-title">Help &amp; guides</h2>
            <p className="muted">
              Follow the company Portal creation guide and browse supporting help.
            </p>
          </div>
          <div>
            <Link href="/help" className="button button-secondary button-link">
              Open help <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
