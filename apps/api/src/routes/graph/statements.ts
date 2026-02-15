import { listStatements } from '@fide.work/db';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { requireGraphReadAuth } from '../../middleware/auth.js';
import type { AppBindings } from '../../middleware/context.js';

const StatementsQuerySchema = z.object({
  subjectFideId: z.string().optional().openapi({
    example: 'did:fide:0x15a1b2c3d4e5f6789012345678901234567890ab',
    description: 'Filter by resolved subject Fide ID',
  }),
  predicateFideId: z.string().optional().openapi({
    example: 'did:fide:0x655e4f6fe94f721628ec6c5d88703f1f4f945a2f',
    description: 'Filter by predicate Fide ID',
  }),
  objectFideId: z.string().optional().openapi({
    example: 'did:fide:0x15b1b2c3d4e5f6789012345678901234567890cd',
    description: 'Filter by resolved object Fide ID',
  }),
  limit: z.coerce.number().int().min(1).max(200).default(50).openapi({
    example: 50,
    description: 'Max number of items to return (1-200)',
  }),
  cursor: z.string().optional().openapi({
    example: 'eyJrIjoiMDAxMjM0In0',
    description: 'Opaque cursor for keyset pagination',
  }),
}).openapi('GraphStatementsQuery');

const StatementItemSchema = z.object({
  statementFingerprint: z.string(),
  subjectFideId: z.string(),
  subjectRawIdentifier: z.string(),
  predicateFideId: z.string(),
  // Kept for legacy clients that still render predicate labels.
  predicateRawIdentifier: z.string(),
  objectFideId: z.string(),
  objectRawIdentifier: z.string(),
}).openapi('GraphStatementItem');

const StatementsResponseSchema = z.object({
  items: z.array(StatementItemSchema),
  nextCursor: z.string().nullable(),
}).openapi('GraphStatementsResponse');

const ErrorSchema = z.object({
  error: z.string(),
}).openapi('GraphErrorResponse');

const app = new OpenAPIHono<AppBindings>();

app.openapi(createRoute({
  method: 'get',
  path: '/v1/statements',
  summary: 'List Graph Statements',
  description: 'List resolved graph statements with keyset pagination.',
  tags: ['Graph'],
  security: [{ apiKeyAuth: [] }],
  request: {
    query: StatementsQuerySchema,
  },
  responses: {
    200: {
      description: 'Paginated statements',
      content: {
        'application/json': {
          schema: StatementsResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid query input',
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
    },
    403: {
      description: 'Forbidden',
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
    },
  },
  middleware: [requireGraphReadAuth],
}), async (c) => {
  try {
    const query = c.req.valid('query');
    const result = await listStatements(query);
    return c.json(result, 200);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Invalid query' }, 400);
  }
});

export default app;
