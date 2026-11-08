import { McpServer } from "@modelcontextprotocol/server"
import { createMcpHandler } from "agents/mcp/server"
import { withX402 } from "agents/x402"
import * as z from "zod"

const fortunes = [
  "A small deploy today saves a large rollback tomorrow.",
  "The bug you seek is in the code you trust most.",
  "Your Durable Object will wake exactly when it is needed.",
  "Cache what you can, invalidate what you must.",
] as const

const pick = () => fortunes[Math.floor(Math.random() * fortunes.length)] ?? fortunes[0]

const text = (value: string) => ({ content: [{ type: "text" as const, text: value }] })

const createServer = (recipient: `0x${string}`) => {
  const server = withX402(new McpServer({ name: "cfas-x402", version: "1.0.0" }), {
    network: "eip155:84532",
    recipient,
    facilitator: { url: "https://x402.org/facilitator" },
  })
  server.registerTool(
    "free_fortune",
    { description: "A free fortune", inputSchema: {} },
    async () => text(pick()),
  )
  server.paidTool(
    "premium_fortune",
    "A premium fortune for a topic. Costs USD 0.01 in USDC on Base Sepolia",
    0.01,
    { topic: z.string().default("software") },
    {},
    async ({ topic }) => text(`On ${topic}: ${pick()}`),
  )
  return server
}

const recipientSchema = z.templateLiteral(["0x", z.string().regex(/^[0-9a-fA-F]{40}$/)])

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const recipient = recipientSchema.parse(env.X402_RECIPIENT)
    const hostname = new URL(request.url).hostname
    return createMcpHandler(() => createServer(recipient), {
      route: "/x402/mcp",
      allowedHostnames: [hostname],
      allowedOriginHostnames: [hostname],
    })(request, env, ctx)
  },
} satisfies ExportedHandler<Env>
