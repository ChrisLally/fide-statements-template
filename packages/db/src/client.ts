import { config as dotenvConfig } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './schema.js';

type DbBundle = {
  db: ReturnType<typeof drizzle<typeof schema>>;
  client: postgres.Sql<{}>;
};

let bundle: DbBundle | null = null;
let envLoaded = false;

function ensureDatabaseUrlLoaded(): void {
  if (process.env.DATABASE_URL) return;
  if (envLoaded) return;
  envLoaded = true;

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const packageDir = resolve(__dirname, '..');
  const envCandidates = [
    resolve(packageDir, '.env'),
    resolve(packageDir, '../.env'),
    resolve(packageDir, '../../.env'),
  ];

  for (const envPath of envCandidates) {
    dotenvConfig({ path: envPath });
    if (process.env.DATABASE_URL) return;
  }
}

function createBundle(): DbBundle {
  ensureDatabaseUrlLoaded();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Missing DATABASE_URL for @fide.work/db');
  }

  const client = postgres(connectionString, {
    max: 20,
    prepare: false,
    idle_timeout: 30,
    connect_timeout: 10,
  });

  const db = drizzle(client, { schema, casing: 'snake_case' });
  return { db, client };
}

export function getDb() {
  if (!bundle) {
    bundle = createBundle();
  }
  return bundle.db;
}

export function getPgClient() {
  if (!bundle) {
    bundle = createBundle();
  }
  return bundle.client;
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_, prop) {
    return getDb()[prop as keyof ReturnType<typeof drizzle<typeof schema>>];
  },
});

export type DbClient = ReturnType<typeof drizzle<typeof schema>>;
export const pgClient = new Proxy({} as postgres.Sql<{}>, {
  get(_, prop) {
    return getPgClient()[prop as keyof postgres.Sql<{}>];
  },
});
