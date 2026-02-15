import { OpenAPIHono } from '@hono/zod-openapi'
import health from './health.js'
import permissionsMe from './permissions-me.js'

const workspace = new OpenAPIHono()

workspace.route('/', health)
workspace.route('/', permissionsMe)

export default workspace
