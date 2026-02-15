import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { db } from '../client.js';
import { fideApiKeys } from '../schema.js';

export const GRAPH_READ_SCOPE = 'graph:read';

type ApiKeySchemaInfo = {
  hasApiKeysTable: boolean;
  hasFideApiKeysTable: boolean;
  apiKeysColumns: Set<string>;
  hasTeamMembersTable: boolean;
  hasRolePermissionsTable: boolean;
  hasPermissionsTable: boolean;
};

let apiKeySchemaInfoPromise: Promise<ApiKeySchemaInfo> | null = null;

export function hashApiKey(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateApiKey(): string {
  return `sk_${randomBytes(24).toString('hex')}`;
}

async function getApiKeySchemaInfo(): Promise<ApiKeySchemaInfo> {
  if (!apiKeySchemaInfoPromise) {
    apiKeySchemaInfoPromise = (async () => {
      const tablesResult = await db.execute(sql<{
        table_name: string;
      }>`
        select table_name
        from information_schema.tables
        where table_schema = 'public'
          and table_name in ('api_keys', 'fide_api_keys', 'team_members', 'role_permissions', 'permissions')
      `);
      const tableRows = tablesResult as unknown as Array<{ table_name: string }>;
      const tableSet = new Set(tableRows.map((row) => row.table_name));

      const columnsResult = await db.execute(sql<{
        column_name: string;
      }>`
        select column_name
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'api_keys'
      `);
      const columnRows = columnsResult as unknown as Array<{ column_name: string }>;

      return {
        hasApiKeysTable: tableSet.has('api_keys'),
        hasFideApiKeysTable: tableSet.has('fide_api_keys'),
        apiKeysColumns: new Set(columnRows.map((row) => row.column_name)),
        hasTeamMembersTable: tableSet.has('team_members'),
        hasRolePermissionsTable: tableSet.has('role_permissions'),
        hasPermissionsTable: tableSet.has('permissions'),
      };
    })();
  }

  return apiKeySchemaInfoPromise;
}

function normalizeScope(scope: string): string {
  if (scope === 'graph.read') return GRAPH_READ_SCOPE;
  return scope;
}

async function resolveScopesForUserId(userId: string, schema: ApiKeySchemaInfo): Promise<string[]> {
  if (!schema.hasTeamMembersTable || !schema.hasRolePermissionsTable || !schema.hasPermissionsTable) {
    return [];
  }

  const rowsResult = await db.execute(sql<{ slug: string }>`
    select distinct p.slug
    from team_members tm
    join role_permissions rp on rp.role_id = tm.role_id
    join permissions p on p.id = rp.permission_id
    where tm.user_id = ${userId}
  `);
  const rows = rowsResult as unknown as Array<{ slug: string }>;

  return Array.from(new Set(rows.map((row) => normalizeScope(row.slug))));
}

export type ActiveApiKey = {
  id: string;
  userId: string | null;
  scopes: string[];
};

type ApiKeyRow = {
  id: string;
  userId: string | null;
  expiresAt: Date | null;
  isActive: boolean | null;
  scopes: string[] | null;
};

async function findApiKeysRow(tokenHash: string, schema: ApiKeySchemaInfo): Promise<ApiKeyRow | null> {
  if (!schema.hasApiKeysTable) return null;

  const selectScopes = schema.apiKeysColumns.has('scopes')
    ? sql`scopes`
    : sql`null::text[] as scopes`;
  const selectIsActive = schema.apiKeysColumns.has('is_active')
    ? sql`is_active`
    : sql`true as is_active`;

  const rowsResult = await db.execute(sql<{
    id: string;
    user_id: string | null;
    expires_at: Date | null;
    is_active: boolean;
    scopes: string[] | null;
  }>`
    select
      id,
      user_id,
      expires_at,
      ${selectIsActive},
      ${selectScopes}
    from api_keys
    where key_hash = ${tokenHash}
    limit 1
  `);
  const rows = rowsResult as unknown as Array<{
    id: string;
    user_id: string | null;
    expires_at: Date | null;
    is_active: boolean;
    scopes: string[] | null;
  }>;
  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    expiresAt: row.expires_at ?? null,
    isActive: row.is_active,
    scopes: row.scopes ?? null,
  };
}

export async function findActiveApiKeyByHash(tokenHash: string): Promise<ActiveApiKey | null> {
  const now = new Date();
  const schema = await getApiKeySchemaInfo();

  const apiKeyRow = await findApiKeysRow(tokenHash, schema);
  if (apiKeyRow) {
    const active = apiKeyRow.isActive !== false;
    const unexpired = !apiKeyRow.expiresAt || apiKeyRow.expiresAt > now;
    if (active && unexpired) {
      if (!apiKeyRow.userId) {
        return null;
      }

      const userScopes = await resolveScopesForUserId(apiKeyRow.userId, schema);
      const scopes = Array.from(new Set(userScopes));
      return {
        id: apiKeyRow.id,
        userId: apiKeyRow.userId,
        scopes,
      };
    }
  }

  if (!schema.hasFideApiKeysTable) {
    return null;
  }

  // Backwards-compatibility fallback intentionally disabled for auth:
  // fide_api_keys has no user linkage, so RBAC cannot be evaluated.
  void tokenHash;
  return null;
}

export async function getPermissionsForUserId(userId: string): Promise<string[]> {
  const schema = await getApiKeySchemaInfo();
  const scopes = await resolveScopesForUserId(userId, schema);
  return Array.from(new Set(scopes));
}

export type WorkspaceScopedPermissions = {
  workspaceId: string;
  permissions: string[];
};

export async function getWorkspaceScopedPermissionsForUserId(
  userId: string,
  workspaceId?: string
): Promise<WorkspaceScopedPermissions[]> {
  const schema = await getApiKeySchemaInfo();
  if (!schema.hasTeamMembersTable || !schema.hasRolePermissionsTable || !schema.hasPermissionsTable) {
    return [];
  }

  const workspaceFilterSql = workspaceId
    ? sql`and tm.team_id = ${workspaceId}`
    : sql``;

  const rowsResult = await db.execute(sql<{
    workspace_id: string;
    permission_slug: string;
  }>`
    select distinct
      tm.team_id as workspace_id,
      p.slug as permission_slug
    from team_members tm
    join role_permissions rp on rp.role_id = tm.role_id
    join permissions p on p.id = rp.permission_id
    where tm.user_id = ${userId}
      ${workspaceFilterSql}
  `);
  const rows = rowsResult as unknown as Array<{
    workspace_id: string;
    permission_slug: string;
  }>;

  const byWorkspace = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!byWorkspace.has(row.workspace_id)) {
      byWorkspace.set(row.workspace_id, new Set());
    }
    byWorkspace.get(row.workspace_id)!.add(normalizeScope(row.permission_slug));
  }

  return Array.from(byWorkspace.entries())
    .map(([workspaceId, permissions]) => ({
      workspaceId,
      permissions: Array.from(permissions).sort(),
    }))
    .sort((a, b) => a.workspaceId.localeCompare(b.workspaceId));
}

export async function touchApiKeyLastUsedAt(id: string): Promise<void> {
  const schema = await getApiKeySchemaInfo();
  const now = new Date();

  if (schema.hasApiKeysTable && schema.apiKeysColumns.has('last_used_at')) {
    if (schema.apiKeysColumns.has('updated_at')) {
      await db.execute(sql`
        update api_keys
        set last_used_at = ${now}, updated_at = ${now}
        where id = ${id}
      `);
    } else {
      await db.execute(sql`
        update api_keys
        set last_used_at = ${now}
        where id = ${id}
      `);
    }
  }

  if (schema.hasFideApiKeysTable) {
    await db.update(fideApiKeys).set({ lastUsedAt: now }).where(eq(fideApiKeys.id, id));
  }
}

export type CreateApiKeyInput = {
  userId?: string | null;
  createdByUserId?: string | null;
  name: string;
  description?: string | null;
  scopes?: string[];
  expiresAt?: Date | null;
};

export async function createApiKey(input: CreateApiKeyInput): Promise<{
  id: string;
  key: string;
  truncatedKey: string;
}> {
  const schema = await getApiKeySchemaInfo();
  const key = generateApiKey();
  const tokenHash = hashApiKey(key);
  const truncatedKey = key.slice(-4);
  const id = `key_${randomUUID()}`;
  const now = new Date();

  if (schema.hasApiKeysTable) {
    await db.execute(sql`
      insert into api_keys (
        id,
        name,
        description,
        key_hash,
        user_id,
        created_by_user_id,
        expires_at,
        created_at,
        updated_at
      ) values (
        ${id},
        ${input.name},
        ${input.description ?? null},
        ${tokenHash},
        ${input.userId ?? null},
        ${input.createdByUserId ?? input.userId ?? null},
        ${input.expiresAt ?? null},
        ${now},
        ${now}
      )
    `);

    if (schema.apiKeysColumns.has('scopes')) {
      await db.execute(sql`
        update api_keys
        set scopes = ${input.scopes?.length ? input.scopes : [GRAPH_READ_SCOPE]}
        where id = ${id}
      `);
    }

    if (schema.apiKeysColumns.has('is_active')) {
      await db.execute(sql`
        update api_keys
        set is_active = true
        where id = ${id}
      `);
    }

    return { id, key, truncatedKey };
  }

  await db.insert(fideApiKeys).values({
    id,
    name: input.name,
    tokenHash,
    truncatedKey,
    scopes: input.scopes?.length ? input.scopes : [GRAPH_READ_SCOPE],
    expiresAt: input.expiresAt ?? null,
    isActive: true,
  });

  return { id, key, truncatedKey };
}

export async function revokeApiKey(id: string): Promise<void> {
  const schema = await getApiKeySchemaInfo();
  const now = new Date();

  if (schema.hasApiKeysTable) {
    if (schema.apiKeysColumns.has('is_active')) {
      if (schema.apiKeysColumns.has('updated_at')) {
        await db.execute(sql`
          update api_keys
          set is_active = false, updated_at = ${now}
          where id = ${id}
        `);
      } else {
        await db.execute(sql`
          update api_keys
          set is_active = false
          where id = ${id}
        `);
      }
    } else {
      await db.execute(sql`
        update api_keys
        set expires_at = ${now}
        where id = ${id}
      `);
    }
  }

  if (schema.hasFideApiKeysTable) {
    await db.update(fideApiKeys).set({ isActive: false }).where(eq(fideApiKeys.id, id));
  }
}

export type ApiKeyListItem = {
  id: string;
  name: string;
  truncatedKey: string;
  scopes: string[];
  isActive: boolean;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date | null;
  userId: string | null;
};

export async function listApiKeys(): Promise<ApiKeyListItem[]> {
  const schema = await getApiKeySchemaInfo();
  const now = new Date();

  if (schema.hasApiKeysTable) {
    const rowsResult = await db.execute(sql<{
      id: string;
      name: string;
      user_id: string | null;
      expires_at: Date | null;
      created_at: Date | null;
      last_used_at: Date | null;
      is_active: boolean | null;
      scopes: string[] | null;
    }>`
      select
        id,
        name,
        user_id,
        expires_at,
        created_at,
        ${schema.apiKeysColumns.has('last_used_at') ? sql`last_used_at` : sql`null::timestamptz as last_used_at`},
        ${schema.apiKeysColumns.has('is_active') ? sql`is_active` : sql`null::boolean as is_active`},
        ${schema.apiKeysColumns.has('scopes') ? sql`scopes` : sql`null::text[] as scopes`}
      from api_keys
      order by created_at desc nulls last
    `);

    const rows = rowsResult as unknown as Array<{
      id: string;
      name: string;
      user_id: string | null;
      expires_at: Date | null;
      created_at: Date | null;
      last_used_at: Date | null;
      is_active: boolean | null;
      scopes: string[] | null;
    }>;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      truncatedKey: '****',
      scopes: row.scopes?.map(normalizeScope) ?? [GRAPH_READ_SCOPE],
      isActive: row.is_active ?? (!row.expires_at || row.expires_at > now),
      expiresAt: row.expires_at ?? null,
      lastUsedAt: row.last_used_at ?? null,
      createdAt: row.created_at ?? null,
      userId: row.user_id ?? null,
    }));
  }

  const legacyRows = await db
    .select({
      id: fideApiKeys.id,
      name: fideApiKeys.name,
      scopes: fideApiKeys.scopes,
      isActive: fideApiKeys.isActive,
      expiresAt: fideApiKeys.expiresAt,
      lastUsedAt: fideApiKeys.lastUsedAt,
      createdAt: fideApiKeys.createdAt,
    })
    .from(fideApiKeys)
    .orderBy(sql`${fideApiKeys.createdAt} desc`);

  return legacyRows.map((row) => ({
    id: row.id,
    name: row.name,
    truncatedKey: '****',
    scopes: row.scopes?.map(normalizeScope) ?? [GRAPH_READ_SCOPE],
    isActive: row.isActive,
    expiresAt: row.expiresAt ?? null,
    lastUsedAt: row.lastUsedAt ?? null,
    createdAt: row.createdAt,
    userId: null,
  }));
}
