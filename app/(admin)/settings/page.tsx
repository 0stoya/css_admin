import type { Metadata } from "next";
import { BellRing, Download } from "lucide-react";
import { PwaInstallControl } from "@/components/pwa-install-control";
import { StaffExportPushControls } from "@/components/staff-export-push-controls";
import styles from "./settings.module.css";

export const metadata: Metadata = {
  title: "Staff Settings",
};

export default function StaffSettingsPage() {
  return (
    <div className="stack section-gap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Your workspace</p>
          <h1>Settings</h1>
          <p className="muted">Manage how CSS Admin works on this device.</p>
        </div>
      </header>

      <div className={styles.settingsGrid}>
        <section className={`card stack ${styles.settingsCard}`} aria-labelledby="staff-push-heading">
          <div className={styles.cardHeading}>
            <span className={styles.cardIcon}><BellRing size={20} aria-hidden="true" /></span>
            <div>
              <h2 id="staff-push-heading">Export notifications</h2>
              <p className="muted">Get a device notification when your own export finishes.</p>
            </div>
          </div>
          <StaffExportPushControls />
          <p className={styles.guidance}>
            Device alerts are optional and depend on your browser and notification permissions.
            The Export Jobs bell still works without them. Only exports requested by your
            signed-in Staff account are eligible for alerts.
          </p>
        </section>

        <section className={`card stack ${styles.settingsCard}`} aria-labelledby="staff-pwa-heading">
          <div className={styles.cardHeading}>
            <span className={styles.cardIcon}><Download size={20} aria-hidden="true" /></span>
            <div>
              <h2 id="staff-pwa-heading">Install CSS Admin</h2>
              <p className="muted">Open Admin like an app on this device.</p>
            </div>
          </div>
          <PwaInstallControl surface="staff" />
          <p className={styles.guidance}>
            When supported, use Install app. On iPhone or iPad, open Admin in Safari and
            choose Share → Add to Home Screen. Your account permissions and session
            checks are exactly the same in the installed app.
          </p>
        </section>
      </div>
    </div>
  );
}
