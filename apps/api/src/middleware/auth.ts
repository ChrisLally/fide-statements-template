import { findActiveApiKeyByHash, hashApiKey, touchApiKeyLastUsedAt } from '@fide.work/db';
import type { MiddlewareHandler } from 'hono';
import type { AppBindings } from './context.js';

async function tryAuthenticateApiKey(token: string) {
  if (!token.startsWith('sk_')) return null;
  const tokenHash = hashApiKey(token);
  const keyRecord = await findActiveApiKeyByHash(tokenHash);
  if (!keyRecord) return null;

  void touchApiKeyLastUsedAt(keyRecord.id);

  return {
    type: 'service' as const,
    id: keyRecord.userId ?? keyRecord.id,
    userId: keyRecord.userId,
    apiKeyId: keyRecord.id,
    scopes: keyRecord.scopes,
  };
}

export const requireGraphReadAuth: MiddlewareHandler<AppBindings> = async (c, next) => {
  const token = c.req.header('X-API-Key');

  if (!token) {
    return c.json({ error: 'Missing X-API-Key header' }, 401);
  }

  const subject = await tryAuthenticateApiKey(token);

  if (!subject) {
    return c.json({ error: 'Invalid or expired API key' }, 401);
  }

  c.set('authSubject', subject);
  await next();
};

export const requireApiKeyAuth: MiddlewareHandler<AppBindings> = requireGraphReadAuth;
