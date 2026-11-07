import { Agent, routeAgentRequest, type Connection } from "agents"
import {
  withVoice,
  WorkersAIFluxSTT,
  WorkersAITTS,
  type Transcriber,
  type VoiceTurnContext,
} from "agents/voice"
import { isStepCount, streamText, tool } from "ai"
import { createWorkersAI } from "workers-ai-provider"
import * as z from "zod"

const VoiceBase = withVoice(Agent)

const instructions = [
  "You are a voice assistant in a demo of Cloudflare Agents. Your answers are spoken aloud,",
  "so reply in one to three short sentences without lists or markdown.",
  "Use get_time for the time and set_reminder when the user asks to be reminded later.",
].join(" ")

export class VoiceAgent extends VoiceBase<Env> {
  override tts = new WorkersAITTS(this.env.AI)

  override createTranscriber(_connection: Connection): Transcriber {
    return new WorkersAIFluxSTT(this.env.AI)
  }

  override async onTurn(transcript: string, context: VoiceTurnContext) {
    const result = streamText({
      model: createWorkersAI({ binding: this.env.AI })("@cf/zai-org/glm-4.7-flash"),
      instructions,
      messages: [
        ...context.messages.map((m) => ({
          role: m.role === "user" ? ("user" as const) : ("assistant" as const),
          content: m.content,
        })),
        { role: "user" as const, content: transcript },
      ],
      tools: {
        get_time: tool({
          description: "Get the current date and time in UTC",
          inputSchema: z.object({}),
          execute: async () => ({ utc: new Date().toISOString() }),
        }),
        set_reminder: tool({
          description: "Speak a reminder to the user after a delay",
          inputSchema: z.object({
            message: z.string(),
            delaySeconds: z.number().int().min(5).max(3600),
          }),
          execute: async ({ message, delaySeconds }) => {
            await this.schedule(delaySeconds, "speakReminder", { message })
            return { scheduled: true, delaySeconds }
          },
        }),
      },
      stopWhen: isStepCount(3),
      abortSignal: context.signal,
    })
    return result.textStream
  }

  async speakReminder(payload: { message: string }) {
    await Promise.all(
      [...this.getConnections()].map((c) => this.speak(c, `Reminder: ${payload.message}`)),
    )
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (await routeAgentRequest(request, env)) ?? new Response("Not found", { status: 404 })
  },
} satisfies ExportedHandler<Env>
