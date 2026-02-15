import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import gateway from './routes/gateway/index.js'
import graph from './routes/graph/index.js'
import workspace from './routes/workspace/index.js'

export const openapiDocument = {
  openapi: '3.1.0' as const,
  info: {
    version: '1.0.0',
    title: 'Fide API',
    description: 'The Fide Platform API'
  },
  servers: [
    {
      url: 'http://localhost:3001',
      description: 'Local development'
    },
    {
      url: 'https://api.fide.work',
      description: 'Production'
    }
  ],
  components: {
    securitySchemes: {
      apiKeyAuth: {
        type: 'apiKey' as const,
        in: 'header' as const,
        name: 'X-API-Key',
        description: 'Graph API key header. Format: sk_...',
      },
      bearerAuth: {
        type: 'http' as const,
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Authorization bearer token (JWT).',
      },
    },
  },
}

export function createApp() {
  const app = new OpenAPIHono()

  app.use('*', cors({
    origin: 'http://localhost:3000',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  }))

  // Root route
  app.get('/', (c) => {
    return c.text('Fide API')
  })

  // Mount platform service routes.
  app.route('/gateway', gateway)
  app.route('/graph', graph)
  app.route('/workspace', workspace)

  // OpenAPI documentation
  app.doc('/openapi.json', openapiDocument)
  app.openAPIRegistry.registerComponent('securitySchemes', 'apiKeyAuth', {
    type: 'apiKey',
    in: 'header',
    name: 'X-API-Key',
    description: 'Graph API key header. Format: sk_...',
  })
  app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'Authorization bearer token (JWT).',
  })

  return app
}
