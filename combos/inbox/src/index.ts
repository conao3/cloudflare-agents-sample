import { Agent, callable, routeAgentEmail, routeAgentRequest } from "agents"
import { createCatchAllEmailResolver, type AgentEmail } from "agents/email"
import { generateText } from "ai"
import PostalMime from "postal-mime"
import { createWorkersAI } from "workers-ai-provider"
import {
  inboxAddress,
  inboxName,
  knowledgeNamespace,
  type InboxState,
  type Thread,
} from "./types.ts"

const embeddingModel = "@cf/baai/bge-m3"
const chatModel = "@cf/zai-org/glm-4.7-flash"
const threadLimit = 20

const str = (value: unknown): string => (typeof value === "string" ? value : "")

export class InboxAgent extends Agent<Env, InboxState> {
  override initialState: InboxState = { threads: [] }

  async onEmail(email: AgentEmail) {
    const parsed = await PostalMime.parse(await email.getRaw())
    const subject = parsed.subject ?? "(no subject)"
    const text = parsed.text ?? ""
    const knowledge = await this.lookup(`${subject}\n${text}`)
    const context = knowledge.map((k, i) => `[${i + 1}] ${k.title}\n${k.text}`).join("\n\n")
    const { text: reply } = await generateText({
      model: createWorkersAI({ binding: this.env.AI })(chatModel),
      instructions:
        "You answer support email. Use only the knowledge base below; if it does not cover the question, say a person will follow up. Write a short plain-text reply without a subject line, signed 'cfas support agent'.",
      prompt: `Knowledge base:\n${context || "(empty)"}\n\nEmail from ${email.from}\nSubject: ${subject}\n\n${text}`,
    })
    await this.replyToEmail(email, { fromName: "cfas support agent", body: reply })
    const thread: Thread = {
      id: crypto.randomUUID(),
      from: email.from,
      subject,
      text,
      reply,
      sources: knowledge.map((k) => k.title),
      receivedAt: new Date().toISOString(),
      simulated: email.headers.get("x-cfas-simulated") === "1",
    }
    this.setState({ threads: [thread, ...this.state.threads].slice(0, threadLimit) })
  }

  @callable()
  async simulate(from: string, subject: string, text: string) {
    const messageId = `<${crypto.randomUUID()}@cfas.example>`
    const raw = new TextEncoder().encode(
      [
        `From: ${from}`,
        `To: ${inboxAddress}`,
        `Subject: ${subject}`,
        `Message-ID: ${messageId}`,
        `Date: ${new Date().toUTCString()}`,
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=utf-8",
        "",
        text,
      ].join("\r\n"),
    )
    await this.onEmail({
      from,
      to: inboxAddress,
      headers: new Headers({ subject, "message-id": messageId, "x-cfas-simulated": "1" }),
      rawSize: raw.byteLength,
      getRaw: async () => raw,
      setReject: () => {},
      forward: async () => ({ messageId: crypto.randomUUID() }),
      reply: async () => ({ messageId: crypto.randomUUID() }),
    })
  }

  @callable()
  clear() {
    this.setState({ threads: [] })
  }

  private async lookup(query: string) {
    const embedded = await this.env.AI.run(embeddingModel, { text: [query] })
    const vector = "data" in embedded ? embedded.data?.[0] : undefined
    if (vector === undefined) return []
    const result = await this.env.VECTORIZE.query(vector, {
      topK: 3,
      namespace: knowledgeNamespace,
      returnMetadata: "all",
    })
    return result.matches
      .filter((m) => m.score > 0.45)
      .map((m) => ({ title: str(m.metadata?.title), text: str(m.metadata?.text) }))
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (await routeAgentRequest(request, env)) ?? new Response("Not found", { status: 404 })
  },
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    await routeAgentEmail(message, env, {
      resolver: createCatchAllEmailResolver("InboxAgent", inboxName),
    })
  },
} satisfies ExportedHandler<Env>
