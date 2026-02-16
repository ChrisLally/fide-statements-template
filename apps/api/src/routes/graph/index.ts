import { OpenAPIHono } from '@hono/zod-openapi'
import health from './health.js'
import statements from './statements.js'
import entities from './entities.js'
import search from './search.js'
import webhooksStatements from './webhooks-statements.js'

const graph = new OpenAPIHono()
const graphApiV1Enabled = process.env.GRAPH_API_V1_ENABLED !== 'false'

graph.route('/', health)
if (graphApiV1Enabled) {
  graph.route('/', statements)
  graph.route('/', entities)
  graph.route('/', search)
}
graph.route('/', webhooksStatements)

export default graph
