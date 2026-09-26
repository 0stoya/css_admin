import postgres from "postgres";

declare global {
  // Reuse one small pool across Next.js server reloads/process lifetime.
  var __cssAdminPostgres: ReturnType<typeof postgres> | undefined;
}

function configuredPoolSize() {
  const value = Number(process.env.CSS_ADMIN_DATABASE_POOL_SIZE ?? "5");
  if (!Number.isInteger(value) || value <= 0) return 5;
  return Math.min(value, 20);
}

export function hasLocalPostgres() {
  return Boolean(process.env.CSS_ADMIN_DATABASE_URL?.trim());
}

export function getLocalPostgres() {
  const connectionString = process.env.CSS_ADMIN_DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("Local Postgres finance storage is not configured on this server.");
  }

  if (!globalThis.__cssAdminPostgres) {
    globalThis.__cssAdminPostgres = postgres(connectionString, {
      max: configuredPoolSize(),
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }

  return globalThis.__cssAdminPostgres;
}
