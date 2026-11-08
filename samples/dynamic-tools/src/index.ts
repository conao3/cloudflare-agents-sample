import {
  AIChatAgent,
  createToolsFromClientSchemas,
  type OnChatMessageOptions,
} from "@cloudflare/ai-chat"
import { routeAgentRequest } from "agents"
import { convertToModelMessages, isStepCount, pruneMessages, streamText } from "ai"
import { createWorkersAI } from "workers-ai-provider"
import { dynamicToolsModel } from "./types.ts"

const instructions = [
  "You are a concise assistant. Your tools are registered by the web page at runtime,",
  "so they can change between messages. Use a tool when it answers the question.",
  "When no tool fits, say which kind of tool the page would need to register.",
  "Answer in the user's language.",
].join(" ")

export class DynamicToolsAgent extends AIChatAgent<Env> {
  override maxPersistedMessages = 100

  override async onChatMessage(_onFinish: unknown, options?: OnChatMessageOptions) {
    const workersai = createWorkersAI({ binding: this.env.AI })
    const result = streamText({
      abortSignal: options?.abortSignal,
      model: workersai(dynamicToolsModel),
      instructions,
      messages: pruneMessages({
        messages: await convertToModelMessages(this.messages),
        toolCalls: "before-last-2-messages",
      }),
      tools: createToolsFromClientSchemas(options?.clientTools),
      stopWhen: isStepCount(5),
    })
    return result.toUIMessageStreamResponse()
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (await routeAgentRequest(request, env)) ?? new Response("Not found", { status: 404 })
  },
} satisfies ExportedHandler<Env>
