/**
 * Database connection config
 *
 * Option A: DATABASE_URL (full postgresql:// URL)
 * Option B: PG_HOST + PG_PORT + PG_USER + PG_PASSWORD + PG_DATABASE
 * Option C: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (Supabase REST)
 */

export type DbMode = "pg" | "supabase";

export function getPgConnectionUrl(): string | null {
  const url =
    process.env.DATABASE_URL ??
    process.env.PGURL;

  if (url) return url;

  const host = process.env.PG_HOST;
  const port = process.env.PG_PORT ?? "5432";
  const user = process.env.PG_USER;
  const password = process.env.PG_PASSWORD;
  const database = process.env.PG_DATABASE ?? "postgres";

  if (!host || !user || !password) return null;

  const encodedPassword = encodeURIComponent(password);
  return `postgresql://${user}:${encodedPassword}@${host}:${port}/${database}`;
}

export function getSupabaseConfig(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (url && key) return { url, key };
  return null;
}

export function getDbMode(): DbMode | null {
  if (getPgConnectionUrl()) return "pg";
  if (getSupabaseConfig()) return "supabase";
  return null;
}
