import type { CompanyEmployee } from "@/lib/graphql/company-employees";

export class KioskEmployeeEnrollmentError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_CONFIGURED" | "UNAVAILABLE" | "REJECTED" | "INVALID_RESPONSE",
    readonly status: number,
  ) {
    super(message);
    this.name = "KioskEmployeeEnrollmentError";
  }
}

type EnrollmentResponse = {
  ok?: boolean;
  code?: string;
  error?: string;
  enrollment?: {
    code?: string;
    companyId?: number;
    employeeId?: number;
    employeeCode?: string | null;
    firstName?: string;
    lastName?: string;
    expiresAt?: string;
  };
};

function kioskBaseUrl() {
  const raw = process.env.CSS_KIOSK_BASE_URL?.trim();
  if (!raw) {
    throw new KioskEmployeeEnrollmentError(
      "CSS_KIOSK_BASE_URL is not configured.",
      "NOT_CONFIGURED",
      503,
    );
  }

  const url = new URL(raw);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new KioskEmployeeEnrollmentError(
      "CSS_KIOSK_BASE_URL must use HTTPS in production.",
      "NOT_CONFIGURED",
      503,
    );
  }

  return url.toString().replace(/\/$/, "");
}

function sharedSecret() {
  const secret = process.env.KIOSK_EMPLOYEE_ENROLLMENT_SHARED_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new KioskEmployeeEnrollmentError(
      "KIOSK_EMPLOYEE_ENROLLMENT_SHARED_SECRET is not configured with a strong value.",
      "NOT_CONFIGURED",
      503,
    );
  }
  return secret;
}

export async function issueKioskEmployeeEnrollment(employee: CompanyEmployee) {
  let response: Response;
  try {
    response = await fetch(`${kioskBaseUrl()}/api/integrations/employee-enrollment`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sharedSecret()}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        companyId: employee.company_id,
        employeeId: employee.employee_id,
        employeeCode: employee.employee_code,
        firstName: employee.first_name,
        lastName: employee.last_name,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    if (error instanceof KioskEmployeeEnrollmentError) throw error;
    throw new KioskEmployeeEnrollmentError(
      "The kiosk enrollment service is unavailable right now.",
      "UNAVAILABLE",
      503,
    );
  }

  let body: EnrollmentResponse;
  try {
    body = (await response.json()) as EnrollmentResponse;
  } catch {
    throw new KioskEmployeeEnrollmentError(
      "The kiosk enrollment service returned an invalid response.",
      "INVALID_RESPONSE",
      502,
    );
  }

  if (!response.ok || !body.ok) {
    throw new KioskEmployeeEnrollmentError(
      body.error || "The kiosk enrollment service rejected the request.",
      "REJECTED",
      response.status >= 400 && response.status < 600 ? response.status : 502,
    );
  }

  const enrollment = body.enrollment;
  if (
    !enrollment ||
    typeof enrollment.code !== "string" ||
    typeof enrollment.companyId !== "number" ||
    typeof enrollment.employeeId !== "number" ||
    typeof enrollment.firstName !== "string" ||
    typeof enrollment.lastName !== "string" ||
    typeof enrollment.expiresAt !== "string"
  ) {
    throw new KioskEmployeeEnrollmentError(
      "The kiosk enrollment service returned an invalid enrollment.",
      "INVALID_RESPONSE",
      502,
    );
  }

  if (
    enrollment.companyId !== employee.company_id ||
    enrollment.employeeId !== employee.employee_id
  ) {
    throw new KioskEmployeeEnrollmentError(
      "The kiosk enrollment service returned the wrong Employee.",
      "INVALID_RESPONSE",
      502,
    );
  }

  return {
    code: enrollment.code,
    employeeCode:
      typeof enrollment.employeeCode === "string" && enrollment.employeeCode.trim()
        ? enrollment.employeeCode.trim()
        : null,
    firstName: enrollment.firstName,
    lastName: enrollment.lastName,
    expiresAt: enrollment.expiresAt,
  };
}
