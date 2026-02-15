import { OpenAPIHono } from '@hono/zod-openapi'
import health from './health.js'
import statements from './statements.js'
import entities from './entities.js'
import search from './search.js'

const graph = new OpenAPIHono()
const graphApiV1Enabled = process.env.GRAPH_API_V1_ENABLED !== 'false'

graph.route('/', health)
if (graphApiV1Enabled) {
  graph.route('/', statements)
  graph.route('/', entities)
  graph.route('/', search)
}

export default graph
