import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { createApp } from './app.js'

const app = createApp()
void Hono

export default app

// Start server
if (!process.env.VERCEL) {
  const port = 3001
  console.log(`Server is running on http://localhost:${port}`)
  console.log(`OpenAPI spec available at http://localhost:${port}/openapi.json`)

  serve({
    fetch: app.fetch,
    port
  })
}
