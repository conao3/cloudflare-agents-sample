import { routedSamples } from "./samples.ts"

const agentPath = /^\/agents\/([^/]+)\//

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const agent = agentPath.exec(new URL(request.url).pathname)?.[1]
    const sample = routedSamples.find((s) => s.agent === agent)
    if (sample === undefined) {
      return new Response("Not found", { status: 404 })
    }
    return env[sample.binding].fetch(request)
  },
} satisfies ExportedHandler<Env>
