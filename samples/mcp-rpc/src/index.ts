import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { Agent, callable, routeAgentRequest } from "agents"
import { McpAgent } from "agents/mcp"
import * as z from "zod"
import type { RpcServer } from "./types.ts"

type CounterState = { total: number }

type CounterProps = { user: string; connectedAt: string }

const text = (value: string) => ({ content: [{ type: "text" as const, text: value }] })

export class McpRpcServer extends McpAgent<Env, CounterState, CounterProps> {
  server = new McpServer({ name: "cfas-mcp-rpc", version: "1.0.0" })
  override initialState: CounterState = { total: 0 }

  async init() {
    this.server.registerTool(
      "add",
      {
        description: "Add a number to the counter kept in the MCP server's own state",
        inputSchema: { amount: z.number().int() },
      },
      async ({ amount }) => {
        this.setState({ total: this.state.total + amount })
        return text(`Added ${amount}; the total is ${this.state.total}`)
      },
    )
    this.server.registerTool(
      "whoami",
      { description: "Return the props the calling agent passed over RPC", inputSchema: {} },
      async () => text(JSON.stringify(this.props ?? null)),
    )
  }
}

export class McpRpcAgent extends Agent<Env> {
  @callable()
  async addCounter(user: string) {
    return this.addMcpServer("counter", this.env.McpRpcServer, {
      props: { user, connectedAt: new Date().toISOString() } satisfies CounterProps,
    })
  }

  @callable()
  async removeCounter(serverId: string) {
    await this.removeMcpServer(serverId)
  }

  @callable()
  servers(): RpcServer[] {
    return Object.entries(this.getMcpServers().servers).map(([id, server]) => ({
      id,
      name: server.name,
      url: server.server_url,
      state: server.state,
    }))
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
