import { NextResponse } from "next/server";
import { getCompanyEmployee } from "@/lib/graphql/company-employees";
import { GraphQLRequestError } from "@/lib/graphql/client";
import {
  issueKioskEmployeeEnrollment,
  KioskEmployeeEnrollmentError,
} from "@/lib/kiosk-employee-enrollment";
import { getAdminToken } from "@/lib/session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; employeeId: string }> },
) {
  if (!(await getAdminToken())) {
    return NextResponse.json(
      { ok: false, code: "AUTH_REQUIRED", error: "Admin authentication is required." },
      { status: 401 },
    );
  }

  const { id, employeeId: employeeIdValue } = await params;
  const companyId = Number(id);
  const employeeId = Number(employeeIdValue);
  if (
    !Number.isInteger(companyId) ||
    companyId <= 0 ||
    !Number.isInteger(employeeId) ||
    employeeId <= 0
  ) {
    return NextResponse.json(
      { ok: false, code: "INVALID_REQUEST", error: "Company and Employee IDs are invalid." },
      { status: 400 },
    );
  }

  try {
    const employee = await getCompanyEmployee(companyId, employeeId);
    if (!employee.active) {
      return NextResponse.json(
        { ok: false, code: "EMPLOYEE_INACTIVE", error: "Inactive Employees cannot be enrolled for kiosk ordering." },
        { status: 409 },
      );
    }

    const enrollment = await issueKioskEmployeeEnrollment(employee);
    return NextResponse.json({
      ok: true,
      enrollment: {
        code: enrollment.code,
        expiresAt: enrollment.expiresAt,
        employee: {
          employeeId: employee.employee_id,
          employeeCode: employee.employee_code,
          name: employee.full_name.trim() || `${employee.first_name} ${employee.last_name}`.trim(),
        },
      },
    });
  } catch (error) {
    if (error instanceof KioskEmployeeEnrollmentError) {
      return NextResponse.json(
        { ok: false, code: error.code, error: error.message },
        { status: error.status },
      );
    }

    if (error instanceof GraphQLRequestError) {
      const status = error.status === 401 ? 401 : 403;
      return NextResponse.json(
        { ok: false, code: "EMPLOYEE_ACCESS_REJECTED", error: error.message },
        { status },
      );
    }

    return NextResponse.json(
      { ok: false, code: "ENROLLMENT_UNAVAILABLE", error: "Employee RFID enrollment could not be started." },
      { status: 503 },
    );
  }
}
