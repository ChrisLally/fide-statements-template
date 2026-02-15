import { getEntityByFideId } from '@fide.work/db';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { requireGraphReadAuth } from '../../middleware/auth.js';
import type { AppBindings } from '../../middleware/context.js';

const ParamsSchema = z.object({
  fideId: z.string().openapi({
    example: 'did:fide:0x15a1b2c3d4e5f6789012345678901234567890ab',
    description: 'Entity Fide ID',
  }),
});

const QuerySchema = z.object({
  statementsLimit: z.coerce.number().int().min(1).max(200).default(25).optional(),
  statementsCursor: z.string().optional(),
}).openapi('GraphEntityQuery');

const StatementSchema = z.object({
  statementFingerprint: z.string(),
  subjectFideId: z.string(),
  subjectRawIdentifier: z.string(),
  predicateFideId: z.string(),
  // Kept for legacy clients that still render predicate labels.
  predicateRawIdentifier: z.string(),
  objectFideId: z.string(),
  objectRawIdentifier: z.string(),
});

const EntityResponseSchema = z.object({
  entityFideId: z.string(),
  primaryRawIdentifier: z.string(),
  aliases: z.array(z.string()),
  statements: z.array(StatementSchema),
  nextCursor: z.string().nullable(),
}).openapi('GraphEntityResponse');

const ErrorSchema = z.object({ error: z.string() }).openapi('GraphEntityErrorResponse');

const app = new OpenAPIHono<AppBindings>();

app.openapi(createRoute({
  method: 'get',
  path: '/v1/entities/{fideId}',
  summary: 'Get Graph Entity',
  description: 'Returns canonical entity details, aliases, and recent statements.',
  tags: ['Graph'],
  security: [{ apiKeyAuth: [] }],
  request: {
    params: ParamsSchema,
    query: QuerySchema,
  },
  responses: {
    200: {
      description: 'Entity found',
      content: {
        'application/json': {
          schema: EntityResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid input',
      content: {
        'application/json': { schema: ErrorSchema },
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
    404: {
      description: 'Entity not found',
      content: {
        'application/json': { schema: ErrorSchema },
      },
    },
  },
  middleware: [requireGraphReadAuth],
}), async (c) => {
  try {
    const { fideId } = c.req.valid('param');
    const query = c.req.valid('query');

    const entity = await getEntityByFideId({
      fideId,
      statementsLimit: query.statementsLimit,
      statementsCursor: query.statementsCursor,
    });

    if (!entity) {
      return c.json({ error: 'Entity not found' }, 404);
    }

    return c.json(entity, 200);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Invalid request' }, 400);
  }
});

export default app;
