import { Agent, callable, routeAgentRequest } from "agents"
import * as z from "zod"
import { gatewayId, type GatewayCall, type GatewayLog, type GatewayState } from "./types.ts"

const model = "@cf/zai-org/glm-4.7-flash"
const callLimit = 20

const answerSchema = z.union([
  z.object({ response: z.string() }),
  z.object({
    choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })),
  }),
])

const readAnswer = (output: unknown): string => {
  const parsed = answerSchema.parse(output)
  return "response" in parsed ? parsed.response : (parsed.choices[0]?.message.content ?? "")
}

export class AiGatewayAgent extends Agent<Env, GatewayState> {
  override initialState: GatewayState = { calls: [] }

  @callable()
  async ask(question: string, cacheTtl: number, skipCache: boolean): Promise<GatewayCall> {
    const started = Date.now()
    const output: unknown = await this.env.AI.run(
      model,
      {
        messages: [
          { role: "system", content: "Answer in one or two sentences." },
          { role: "user", content: question },
        ],
      },
      { gateway: { id: gatewayId, cacheTtl, skipCache, metadata: { sample: "cfas-ai-gateway" } } },
    )
    const call: GatewayCall = {
      id: crypto.randomUUID(),
      question,
      answer: readAnswer(output),
      logId: this.env.AI.aiGatewayLogId,
      ms: Date.now() - started,
      cacheTtl,
      skipCache,
      at: new Date().toISOString(),
    }
    this.setState({ calls: [call, ...this.state.calls].slice(0, callLimit) })
    return call
  }

  @callable()
  async log(logId: string): Promise<GatewayLog> {
    const log = await this.env.AI.gateway(gatewayId).getLog(logId)
    return {
      cached: log.cached,
      durationMs: log.duration,
      tokensIn: log.tokens_in ?? null,
      tokensOut: log.tokens_out ?? null,
      statusCode: log.status_code,
      model: log.model,
      provider: log.provider,
    }
  }

  @callable()
  clear() {
    this.setState({ calls: [] })
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (await routeAgentRequest(request, env)) ?? new Response("Not found", { status: 404 })
  },
} satisfies ExportedHandler<Env>
