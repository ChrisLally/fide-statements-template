import { createApp } from './app.js'

const app = createApp()

export default {
  fetch(request: Request, env: Record<string, unknown>, ctx: ExecutionContext) {
    // Keep existing process.env-based configuration working on Workers.
    Object.assign(process.env, env)
    return app.fetch(request, env, ctx)
  },
}
