import { Agent, callable, routeAgentRequest } from "agents"
import type { ElicitRequest, ElicitResult } from "agents/mcp/client"
import {
  elicitationTimeoutMs,
  type ElicitationAnswer,
  type ElicitationSettled,
  type PendingElicitation,
} from "./types.ts"

type Waiting = { message: PendingElicitation; resolve: (result: ElicitResult) => void }

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  )

export class McpClientAgent extends Agent<Env> {
  waiting = new Map<string, Waiting>()

  override onStart() {
    this.mcp.configureOAuthCallback({
      customHandler: (result) =>
        result.authSuccess
          ? new Response("<script>window.close()</script>", {
              headers: { "content-type": "text/html; charset=utf-8" },
            })
          : new Response(
              `<!doctype html><p>Authorization failed: ${escapeHtml(result.authError)}</p>`,
              { status: 400, headers: { "content-type": "text/html; charset=utf-8" } },
            ),
    })
    this.mcp.configureElicitationHandlers({
      form: (request, serverId) => this.askBrowser(request, serverId),
      url: (request, serverId) => this.askBrowser(request, serverId),
    })
  }

  askBrowser(request: ElicitRequest, serverId: string): Promise<ElicitResult> {
    const message: PendingElicitation = {
      type: "mcp-elicitation",
      id: crypto.randomUUID(),
      serverId,
      params: request.params,
    }
    return new Promise((resolve) => {
      this.waiting.set(message.id, { message, resolve })
      this.broadcast(JSON.stringify(message))
      setTimeout(() => this.settle(message.id, { action: "cancel" }), elicitationTimeoutMs)
    })
  }

  settle(id: string, result: ElicitResult) {
    const entry = this.waiting.get(id)
    if (entry === undefined) return false
    this.waiting.delete(id)
    entry.resolve(result)
    this.broadcast(
      JSON.stringify({ type: "mcp-elicitation-settled", id } satisfies ElicitationSettled),
    )
    return true
  }

  @callable()
  respondToElicitation(id: string, result: ElicitationAnswer) {
    return this.settle(id, result)
  }

  @callable()
  pendingElicitations() {
    return [...this.waiting.values()].map((entry) => entry.message)
  }

  @callable()
  async addServer(name: string, url: string) {
    await this.addMcpServer(name, url)
  }

  @callable()
  async removeServer(serverId: string) {
    await this.removeMcpServer(serverId)
  }

  @callable()
  async callTool(serverId: string, name: string, args: Record<string, unknown>) {
    return this.mcp.callTool({ serverId, name, arguments: args })
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (await routeAgentRequest(request, env)) ?? new Response("Not found", { status: 404 })
  },
} satisfies ExportedHandler<Env>
