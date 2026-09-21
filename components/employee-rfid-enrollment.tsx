"use client";

import { useState } from "react";
import { AdminActionModal, AdminCloseFooter } from "@/components/admin-action-modal";
import styles from "./employee-rfid-enrollment.module.css";

type EnrollmentResult = {
  code: string;
  expiresAt: string;
  employee: {
    employeeId: number;
    employeeCode: string | null;
    name: string;
  };
};

type EnrollmentResponse = {
  ok?: boolean;
  code?: string;
  error?: string;
  enrollment?: EnrollmentResult;
};

export function EmployeeRfidEnrollment({
  companyId,
  employeeId,
  employeeName,
  employeeCode,
  active,
}: {
  companyId: number;
  employeeId: number;
  employeeName: string;
  employeeCode: string | null;
  active: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [enrollment, setEnrollment] = useState<EnrollmentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function issueCode() {
    if (!active || loading) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/companies/${companyId}/employees/${employeeId}/rfid-enrollment`,
        {
          method: "POST",
          headers: { Accept: "application/json" },
          cache: "no-store",
        },
      );
      const body = (await response.json()) as EnrollmentResponse;

      if (!response.ok || !body.ok || !body.enrollment) {
        setError(body.error || "Employee RFID enrollment could not be started.");
        return;
      }

      setEnrollment(body.enrollment);
    } catch {
      setError("Employee RFID enrollment could not be started.");
    } finally {
      setLoading(false);
    }
  }

  const expiresAt = enrollment ? new Date(enrollment.expiresAt) : null;
  const expiryLabel =
    expiresAt && !Number.isNaN(expiresAt.getTime())
      ? new Intl.DateTimeFormat("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(expiresAt)
      : enrollment?.expiresAt || null;

  return (
    <AdminActionModal
      title={`Enroll RFID · ${employeeName}`}
      description={`${employeeCode || `Employee #${employeeId}`} · links this Employee's own Magento account, canonical Employee and NEXT ARGO badge identity.`}
      triggerLabel="RFID"
      triggerIcon="rfid"
    >
      <div className={styles.content}>
        {!active ? (
          <div className="error">Reactivate this Employee before enrolling an RFID.</div>
        ) : null}

        <div className={styles.instructions}>
          <strong>One-time enrollment</strong>
          <span>
            Generate a short-lived code here, enter it on the trusted kiosk, then have the Employee tap their RFID.
          </span>
          <span>
            If the RFID has not been linked to their Magento account before, the kiosk will ask them to sign in once.
          </span>
        </div>

        {error ? <div className="error" role="alert">{error}</div> : null}

        {enrollment ? (
          <div className={styles.codeCard}>
            <span>Enrollment code</span>
            <strong>{enrollment.code}</strong>
            <small>Valid until {expiryLabel}. One use only.</small>
          </div>
        ) : null}

        <div className={styles.actions}>
          <button className="button" type="button" onClick={() => void issueCode()} disabled={!active || loading}>
            {loading ? "Generating…" : enrollment ? "Generate new code" : "Generate enrollment code"}
          </button>
        </div>

        <div className={styles.securityNote}>
          The raw RFID never comes through CSS Admin. It is read only at the trusted kiosk and stored by CSS as a credential hash.
        </div>

        <AdminCloseFooter />
      </div>
    </AdminActionModal>
  );
}
