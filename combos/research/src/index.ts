import { AIChatAgent, type OnChatMessageOptions } from "@cloudflare/ai-chat"
import { callable, routeAgentRequest } from "agents"
import { browserMarkdown } from "agents/browser"
import { createQuickActionTools } from "agents/browser/ai"
import { convertToModelMessages, generateText, isStepCount, streamText, tool } from "ai"
import { createWorkersAI } from "workers-ai-provider"
import * as z from "zod"
import type { Note, ResearchState, Watch } from "./types.ts"

const model = "@cf/zai-org/glm-4.7-flash"
const noteLimit = 30

const instructions = [
  "You are a research assistant in a demo of Cloudflare Agents.",
  "Read pages with the browser_* tools and answer from what they return.",
  "When the user wants a page watched, call watchPage; the user approves it before it runs.",
  "Answer in the user's language.",
].join(" ")

export class ResearchAgent extends AIChatAgent<Env, ResearchState> {
  override initialState: ResearchState = { notes: [] }
  override maxPersistedMessages = 60

  override async onChatMessage(_onFinish: unknown, options?: OnChatMessageOptions) {
    const tools = {
      ...createQuickActionTools({ browser: this.env.BROWSER }),
      watchPage: tool({
        description: "Re-read a page on an interval and keep a short summary of it each time",
        inputSchema: z.object({
          url: z.string().url(),
          intervalMinutes: z.number().int().min(1).max(1440),
        }),
        needsApproval: async () => true,
        execute: async ({ url, intervalMinutes }) => {
          const schedule = await this.scheduleEvery(intervalMinutes * 60, "recheck", { url })
          await this.recheck({ url })
          return { watchId: schedule.id, url, intervalMinutes }
        },
      }),
    }
    const result = streamText({
      abortSignal: options?.abortSignal,
      model: createWorkersAI({ binding: this.env.AI })(model),
      instructions,
      messages: await convertToModelMessages(this.messages, { tools }),
      tools,
      stopWhen: isStepCount(6),
    })
    return result.toUIMessageStreamResponse()
  }

  async recheck(payload: { url: string }) {
    const { url } = payload
    const note = await browserMarkdown(this.env.BROWSER, { url })
      .then(async (markdown) => {
        const { text } = await generateText({
          model: createWorkersAI({ binding: this.env.AI })(model),
          prompt: `Summarize this page in two sentences.\n\n${markdown.slice(0, 6000)}`,
        })
        return { summary: text, ok: true }
      })
      .catch((error: unknown) => ({
        summary: error instanceof Error ? error.message : String(error),
        ok: false,
      }))
    const entry: Note = { id: crypto.randomUUID(), url, at: new Date().toISOString(), ...note }
    this.setState({ notes: [entry, ...this.state.notes].slice(0, noteLimit) })
  }

  @callable()
  async watches(): Promise<Watch[]> {
    const schedules = await this.listSchedules()
    return schedules.flatMap((s) =>
      s.type === "interval" && s.callback === "recheck"
        ? [
            {
              id: s.id,
              url: z.object({ url: z.string() }).parse(s.payload).url,
              intervalMinutes: s.intervalSeconds / 60,
              nextAt: s.time,
            },
          ]
        : [],
    )
  }

  @callable()
  async unwatch(id: string) {
    return this.cancelSchedule(id)
  }

  @callable()
  clearNotes() {
    this.setState({ notes: [] })
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (await routeAgentRequest(request, env)) ?? new Response("Not found", { status: 404 })
  },
} satisfies ExportedHandler<Env>
