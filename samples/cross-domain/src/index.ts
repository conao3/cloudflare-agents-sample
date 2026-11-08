import { Agent, callable, routeAgentRequest, type Connection, type ConnectionContext } from "agents"
import type { CrossDomainState, Visit } from "./types.ts"

const visitLimit = 10

export class CrossDomainAgent extends Agent<Env, CrossDomainState> {
  override initialState: CrossDomainState = { visits: [] }

  override onConnect(_connection: Connection, ctx: ConnectionContext) {
    this.record(ctx.request, "websocket")
  }

  override onRequest(request: Request): Response {
    const visit = this.record(request, "http")
    return Response.json({ ...visit, visits: this.state.visits.length })
  }

  @callable()
  hello(name: string): string {
    return `Hello ${name}, from ${this.name} at ${new Date().toISOString()}`
  }

  @callable()
  clear() {
    this.setState({ visits: [] })
  }

  private record(request: Request, via: Visit["via"]): Visit {
    const visit: Visit = {
      origin: request.headers.get("Origin") ?? "(no Origin header)",
      via,
      at: new Date().toISOString(),
    }
    this.setState({ visits: [visit, ...this.state.visits].slice(0, visitLimit) })
    return visit
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (
      (await routeAgentRequest(request, env, { cors: true })) ??
      new Response("Not found", { status: 404 })
    )
  },
} satisfies ExportedHandler<Env>
