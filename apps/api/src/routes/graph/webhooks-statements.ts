import { processGithubWebhookPayload } from '@fide.work/indexer';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import type { AppBindings } from '../../middleware/context.js';

const WebhookItemSchema = z.object({
  path: z.string(),
  root: z.string(),
  sha256: z.string(),
}).openapi('GraphWebhookItem');

const WebhookPayloadSchema = z.object({
  repo: z.string().openapi({ example: 'ChrisLally/fide-statements-template' }),
  repoId: z.string().openapi({ example: '982559179' }),
  ownerId: z.string().openapi({ example: '43071816' }),
  sha: z.string().openapi({ example: 'ba1e9392d8078f204388c0794c27f0e3490ec046' }),
  runId: z.string().openapi({ example: '22072343211' }),
  items: z.array(WebhookItemSchema),
}).openapi('GraphStatementsWebhookPayload');

const ProcessedBatchSchema = z.object({
  repo: z.string(),
  sha: z.string(),
  path: z.string(),
  root: z.string(),
  insertedBatch: z.boolean(),
  statementCount: z.number().int(),
}).openapi('GraphProcessedBatch');

const WebhookResponseSchema = z.object({
  ok: z.boolean(),
  processed: z.array(ProcessedBatchSchema),
}).openapi('GraphStatementsWebhookResponse');

const ErrorSchema = z.object({
  error: z.string(),
}).openapi('GraphWebhookError');

const app = new OpenAPIHono<AppBindings>();

app.openapi(createRoute({
  method: 'post',
  path: '/v1/webhooks/statements',
  summary: 'Process Statement Batch Webhook',
  description: 'Accepts statement-batch webhook payloads and ingests them into Fide Graph.',
  tags: ['Graph'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: WebhookPayloadSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Webhook processed',
      content: {
        'application/json': {
          schema: WebhookResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid webhook payload',
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
    },
    500: {
      description: 'Webhook processing failed',
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
    },
  },
}), async (c) => {
  try {
    const payload = c.req.valid('json');
    const processed = await processGithubWebhookPayload(payload);
    return c.json({ ok: true, processed }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed';
    const status = message.startsWith('Invalid webhook payload') ? 400 : 500;
    return c.json({ error: message }, status as 400 | 500);
  }
});

export default app;
