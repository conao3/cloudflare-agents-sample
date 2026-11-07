import { AIChatAgent, type OnChatMessageOptions } from "@cloudflare/ai-chat"
import { routeAgentRequest } from "agents"
import { convertToModelMessages, isStepCount, streamText, tool } from "ai"
import { createWorkersAI } from "workers-ai-provider"
import * as z from "zod"
import { chatModel } from "./types.ts"

const instructions = [
  "You are a concise assistant in a demo of Cloudflare Agents.",
  "Use getWeather for weather questions, getLocalTime when you need the user's time,",
  "and transferPoints when the user asks to send points. Answer in the user's language.",
].join(" ")

export class ChatAgent extends AIChatAgent<Env> {
  override maxPersistedMessages = 100

  override async onChatMessage(_onFinish: unknown, options?: OnChatMessageOptions) {
    const workersai = createWorkersAI({ binding: this.env.AI })
    const tools = {
      getWeather: tool({
        description: "Get the current weather for a city",
        inputSchema: z.object({ city: z.string().describe("City name") }),
        execute: async ({ city }) => {
          const conditions = ["sunny", "cloudy", "rainy", "snowy"] as const
          return {
            city,
            temperatureCelsius: 5 + Math.floor(Math.random() * 25),
            condition: conditions[Math.floor(Math.random() * conditions.length)],
          }
        },
      }),
      getLocalTime: tool({
        description: "Get the user's local time and timezone from their browser",
        inputSchema: z.object({}),
      }),
      transferPoints: tool({
        description: "Send demo points to a person. The user must approve each transfer.",
        inputSchema: z.object({
          to: z.string().describe("Recipient name"),
          points: z.number().int().positive(),
        }),
        needsApproval: async () => true,
        execute: async ({ to, points }) => ({ to, points, status: "sent" }),
      }),
    }
    const result = streamText({
      abortSignal: options?.abortSignal,
      model: workersai(chatModel),
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
