import { McpServer } from "@modelcontextprotocol/server"
import { createMcpHandler } from "agents/mcp/server"
import * as z from "zod"

const text = (value: string) => ({ content: [{ type: "text" as const, text: value }] })

const createServer = () => {
  const server = new McpServer({ name: "cfas-mcp-server", version: "1.0.0" })
  server.registerTool(
    "roll_dice",
    {
      description: "Roll dice and return each value and the total",
      inputSchema: {
        count: z.number().int().min(1).max(20).default(1),
        sides: z.number().int().min(2).max(100).default(6),
      },
    },
    async ({ count, sides }) => {
      const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides))
      return text(`${rolls.join(", ")} (total ${rolls.reduce((a, b) => a + b, 0)})`)
    },
  )
  server.registerTool(
    "utc_now",
    { description: "Return the current time in UTC (ISO 8601)", inputSchema: {} },
    async () => text(new Date().toISOString()),
  )
  server.registerTool(
    "word_count",
    {
      description: "Count characters, words, and lines in a text",
      inputSchema: { text: z.string() },
    },
    async ({ text: input }) =>
      text(
        JSON.stringify({
          characters: Array.from(new Intl.Segmenter().segment(input)).length,
          words: input.split(/\s+/).filter(Boolean).length,
          lines: input.split("\n").length,
        }),
      ),
  )
  return server
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const hostname = new URL(request.url).hostname
    return createMcpHandler(createServer, {
      allowedHostnames: [hostname],
      allowedOriginHostnames: [hostname],
    })(request, env, ctx)
  },
} satisfies ExportedHandler<Env>
