import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'

const WorkspaceHealthResponseSchema = z.object({
  status: z.string().openapi({
    example: 'ok',
    description: 'The status of the workspace service',
  }),
  uptime: z.number().openapi({
    example: 123.45,
    description: 'The uptime of the process in seconds',
  }),
  timestamp: z.string().openapi({
    example: '2024-02-09T10:54:19Z',
    description: 'The current server timestamp',
  }),
}).openapi('WorkspaceHealthResponse')

export const workspaceHealthRoute = createRoute({
  method: 'get',
  path: '/v1/health',
  summary: 'Check Workspace API Health',
  tags: ['Workspace'],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: WorkspaceHealthResponseSchema,
        },
      },
      description: 'Workspace API is healthy',
    },
  },
})

const app = new OpenAPIHono()

app.openapi(workspaceHealthRoute, (c) => {
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
