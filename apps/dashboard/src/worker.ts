import { findSample } from "./samples.ts"

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const sample = findSample(new URL(request.url).pathname)
    if (sample === undefined) {
      return new Response("Not found", { status: 404 })
    }
    return env[sample.binding].fetch(request)
  },
} satisfies ExportedHandler<Env>
