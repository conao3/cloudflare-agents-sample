import { McpServer } from "@modelcontextprotocol/server"
import { browserLinks, browserMarkdown } from "agents/browser"
import { createMcpHandler } from "agents/mcp/server"
import { generateText } from "ai"
import { createWorkersAI } from "workers-ai-provider"
import * as z from "zod"

const embeddingModel = "@cf/baai/bge-m3"
const chatModel = "@cf/zai-org/glm-4.7-flash"
const knowledgeNamespace = "default"

const text = (value: string) => ({ content: [{ type: "text" as const, text: value }] })
const str = (value: unknown): string => (typeof value === "string" ? value : "")

const search = async (env: Env, query: string, topK: number) => {
  const embedded = await env.AI.run(embeddingModel, { text: [query] })
  const vector = "data" in embedded ? embedded.data?.[0] : undefined
  if (vector === undefined) return []
  const result = await env.VECTORIZE.query(vector, {
    topK,
    namespace: knowledgeNamespace,
    returnMetadata: "all",
  })
  return result.matches.map((m) => ({
    title: str(m.metadata?.title),
    text: str(m.metadata?.text),
    score: Number(m.score.toFixed(3)),
  }))
}

const createServer = (env: Env) => () => {
  const server = new McpServer({ name: "cfas-tool-hub", version: "1.0.0" })
  server.registerTool(
    "read_page",
    {
      description:
        "Render a web page in Browser Run and return it as Markdown (truncated to 8,000 characters)",
      inputSchema: { url: z.string().url() },
    },
    async ({ url }) => text((await browserMarkdown(env.BROWSER, { url })).slice(0, 8000)),
  )
  server.registerTool(
    "list_links",
    { description: "List the links on a web page", inputSchema: { url: z.string().url() } },
    async ({ url }) => text((await browserLinks(env.BROWSER, { url })).join("\n")),
  )
  server.registerTool(
    "search_docs",
    {
      description: "Semantic search over the documents stored by the RAG sample",
      inputSchema: { query: z.string(), topK: z.number().int().min(1).max(10).default(4) },
    },
    async ({ query, topK }) => text(JSON.stringify(await search(env, query, topK), null, 2)),
  )
  server.registerTool(
    "ask_docs",
    {
      description: "Answer a question from the RAG sample's documents, with citations",
      inputSchema: { question: z.string() },
    },
    async ({ question }) => {
      const hits = await search(env, question, 4)
      const context = hits.map((h, i) => `[${i + 1}] ${h.title}\n${h.text}`).join("\n\n")
      const { text: answer } = await generateText({
        model: createWorkersAI({ binding: env.AI })(chatModel),
        instructions:
          "Answer using only the numbered context and cite like [1]. Say so when the context lacks the answer.",
        prompt: `Context:\n${context}\n\nQuestion: ${question}`,
      })
      return text(answer)
    },
  )
  return server
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const hostname = new URL(request.url).hostname
    return createMcpHandler(createServer(env), {
      route: "/hub/mcp",
      allowedHostnames: [hostname],
      allowedOriginHostnames: [hostname],
    })(request, env, ctx)
  },
} satisfies ExportedHandler<Env>
