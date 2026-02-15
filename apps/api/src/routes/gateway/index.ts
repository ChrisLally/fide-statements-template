import { OpenAPIHono } from '@hono/zod-openapi'
import health from './health.js'

const gateway = new OpenAPIHono()

gateway.route('/', health)

export default gateway
