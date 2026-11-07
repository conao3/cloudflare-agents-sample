import { findSample } from "./samples.ts"

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const sample = findSample(new URL(request.url).pathname)
    if (sample === undefined) {
      return new Response("Not found", { status: 404 })
    }
    const service: Fetcher | undefined = env[sample.binding]
    if (service === undefined) {
      return new Response(`${sample.title} is not deployed here: ${sample.localOnly ?? ""}`, {
        status: 404,
      })
    }
    return service.fetch(request)
  },
} satisfies ExportedHandler<Env>
