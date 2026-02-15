import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'

const GatewayHealthResponseSchema = z.object({
  status: z.string().openapi({
    example: 'ok',
    description: 'The status of the gateway service',
  }),
  uptime: z.number().openapi({
    example: 123.45,
    description: 'The uptime of the process in seconds',
  }),
  timestamp: z.string().openapi({
    example: '2024-02-09T10:54:19Z',
    description: 'The current server timestamp',
  }),
}).openapi('GatewayHealthResponse')

export const gatewayHealthRoute = createRoute({
  method: 'get',
  path: '/v1/health',
  summary: 'Check Gateway API Health',
  tags: ['Gateway'],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: GatewayHealthResponseSchema,
        },
      },
      description: 'Gateway API is healthy',
    },
  },
})

const app = new OpenAPIHono()

app.openapi(gatewayHealthRoute, (c) => {
  return c.json(
    {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
    200
  )
})

export default app
