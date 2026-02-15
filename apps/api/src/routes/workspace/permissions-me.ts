import { getWorkspaceScopedPermissionsForUserId } from '@fide.work/db';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { requireApiKeyAuth } from '../../middleware/auth.js';
import type { AppBindings } from '../../middleware/context.js';

const PermissionsMeResponseSchema = z.object({
  userId: z.string().openapi({
    example: 'user_123',
    description: 'User principal resolved from the API key.',
  }),
  workspaces: z.array(
    z.object({
      workspaceId: z.string().openapi({
        example: 'team_123',
        description: 'Workspace/team identifier.',
      }),
      permissions: z.array(z.string()).openapi({
        example: ['graph:read'],
        description: 'Effective permission slugs within this workspace.',
      }),
    })
  ).openapi({
    description: 'Workspace-scoped effective permissions.',
  }),
}).openapi('WorkspacePermissionsMeResponse');

const ErrorSchema = z.object({
  error: z.string(),
}).openapi('WorkspacePermissionsMeError');

const route = createRoute({
  method: 'get',
  path: '/v1/permissions/me',
  summary: 'Get Effective Permissions',
  description: 'Returns workspace-scoped effective permission slugs for the authenticated API key principal.',
  tags: ['Workspace'],
  security: [{ apiKeyAuth: [] }],
  request: {
    query: z.object({
      workspaceId: z.string().optional().openapi({
        example: 'team_123',
        description: 'Optional workspace/team ID to filter permissions.',
      }),
    }),
  },
  responses: {
    200: {
      description: 'Effective permissions for current principal',
      content: {
        'application/json': {
          schema: PermissionsMeResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': { schema: ErrorSchema },
      },
    },
    403: {
      description: 'Forbidden',
      content: {
        'application/json': { schema: ErrorSchema },
      },
    },
  },
  middleware: [requireApiKeyAuth],
});

const app = new OpenAPIHono<AppBindings>();

app.openapi(route, async (c) => {
  const query = c.req.valid('query');
  const subject = c.get('authSubject') as AppBindings['Variables']['authSubject'];
  if (!subject) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const userId = subject?.userId ?? null;

  if (!userId) {
    return c.json({ error: 'API key is not linked to a user principal' }, 403);
  }

  const workspaces = await getWorkspaceScopedPermissionsForUserId(userId, query.workspaceId);
  return c.json({ userId, workspaces }, 200);
});

export default app;
