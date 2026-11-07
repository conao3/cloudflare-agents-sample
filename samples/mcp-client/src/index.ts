import { Agent, callable, routeAgentRequest } from "agents"

export class McpClientAgent extends Agent<Env> {
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
