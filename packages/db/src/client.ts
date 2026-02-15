import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

type DbBundle = {
  db: ReturnType<typeof drizzle<typeof schema>>;
  client: postgres.Sql<{}>;
};

let bundle: DbBundle | null = null;

function createBundle(): DbBundle {
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
