import { AIChatAgent, type OnChatMessageOptions } from "@cloudflare/ai-chat"
import { routeAgentRequest } from "agents"
import { convertToModelMessages, isStepCount, streamText, tool } from "ai"
import { createWorkersAI } from "workers-ai-provider"
import * as z from "zod"
import { structuredInputModel } from "./types.ts"

const instructions = [
  "You gather information from the user through forms shown in the chat.",
  "Ask one question at a time with a tool instead of writing the question as text:",
  "askChoice when there are clear options, askYesNo for a yes/no decision,",
  "and askRating for a score. After each answer, acknowledge it in one short sentence",
  "and ask the next question, up to three questions, then summarize the answers.",
  "Answer in the user's language.",
].join(" ")

const tools = {
  askChoice: tool({
    description: "Show the user a question with options to pick from",
    inputSchema: z.object({
      question: z.string().describe("The question to ask"),
      options: z.array(z.string()).min(2).describe("The choices"),
      allowMultiple: z.boolean().default(false).describe("Whether several options may be picked"),
    }),
  }),
  askYesNo: tool({
    description: "Ask the user a yes/no question",
    inputSchema: z.object({ question: z.string().describe("The yes/no question") }),
  }),
  askRating: tool({
    description: "Ask the user to rate something on a scale",
    inputSchema: z.object({
      question: z.string().describe("What to rate"),
      min: z.number().int().default(1),
      max: z.number().int().default(5),
    }),
  }),
}

export class StructuredInputAgent extends AIChatAgent<Env> {
  override maxPersistedMessages = 100

  override async onChatMessage(_onFinish: unknown, options?: OnChatMessageOptions) {
    const workersai = createWorkersAI({ binding: this.env.AI })
    const result = streamText({
      abortSignal: options?.abortSignal,
      model: workersai(structuredInputModel),
      instructions,
      messages: await convertToModelMessages(this.messages, { tools }),
      tools,
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
