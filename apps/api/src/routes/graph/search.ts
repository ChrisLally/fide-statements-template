import { searchGraph } from '@fide.work/db';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { FIDE_ENTITY_TYPE_MAP } from '@fide.work/fcp';
import { requireGraphReadAuth } from '../../middleware/auth.js';
import type { AppBindings } from '../../middleware/context.js';

const ENTITY_TYPE_CHARS = Array.from(
  new Set(Object.values(FIDE_ENTITY_TYPE_MAP))
) as [
  (typeof FIDE_ENTITY_TYPE_MAP)[keyof typeof FIDE_ENTITY_TYPE_MAP],
  ...(typeof FIDE_ENTITY_TYPE_MAP)[keyof typeof FIDE_ENTITY_TYPE_MAP][]
];

const SearchQuerySchema = z.object({
  q: z.string().min(1).openapi({
    example: 'alice',
    description: 'Search query (raw identifier substring)',
  }),
  type: z.enum(ENTITY_TYPE_CHARS).optional().openapi({
    example: '1',
    description: 'Optional entity type-char filter',
  }),
  limit: z.coerce.number().int().min(1).max(100).default(20).openapi({
    example: 20,
    description: 'Max number of items to return (1-100)',
  }),
  cursor: z.string().optional().openapi({
    example: 'eyJrIjoiMDAxMjM0In0',
    description: 'Opaque cursor for keyset pagination',
  }),
}).openapi('GraphSearchQuery');

const SearchItemSchema = z.object({
  fideId: z.string(),
  rawIdentifier: z.string(),
  type: z.string(),
  sourceType: z.string(),
}).openapi('GraphSearchItem');

const SearchResponseSchema = z.object({
  items: z.array(SearchItemSchema),
  nextCursor: z.string().nullable(),
}).openapi('GraphSearchResponse');

const ErrorSchema = z.object({ error: z.string() }).openapi('GraphSearchErrorResponse');

const app = new OpenAPIHono<AppBindings>();

app.openapi(createRoute({
  method: 'get',
  path: '/v1/search',
  summary: 'Search Graph Entities',
  description: 'Search resolved graph identifiers with keyset pagination.',
  tags: ['Graph'],
  security: [{ apiKeyAuth: [] }],
  request: {
    query: SearchQuerySchema,
  },
  responses: {
    200: {
      description: 'Search results',
      content: {
        'application/json': {
          schema: SearchResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid query input',
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
  },
  middleware: [requireGraphReadAuth],
}), async (c) => {
  try {
    const query = c.req.valid('query');
    const result = await searchGraph(query);
    return c.json(result, 200);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Invalid query' }, 400);
  }
});

export default app;
