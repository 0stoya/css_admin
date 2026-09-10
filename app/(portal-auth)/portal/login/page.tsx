import { redirect } from "next/navigation";

export default async function LegacyCompanyLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  redirect(reason === "expired" ? "/login?reason=expired" : "/login");
}
