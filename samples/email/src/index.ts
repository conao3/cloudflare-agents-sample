import { Agent, callable, routeAgentEmail, routeAgentRequest } from "agents"
import { createCatchAllEmailResolver, type AgentEmail } from "agents/email"
import PostalMime from "postal-mime"
import { agentAddress, inboxName, type EmailState, type MailEntry } from "./types.ts"

const mailLimit = 30

const rawMessage = (
  from: string,
  to: string,
  subject: string,
  messageId: string,
  text: string,
): string =>
  [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Message-ID: ${messageId}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    text,
  ].join("\r\n")

const replyText = (subject: string, text: string): string => {
  const words = text.split(/\s+/).filter(Boolean).length
  return [
    `Thanks for your message "${subject}".`,
    `It had ${words} words and arrived at ${new Date().toISOString()}.`,
    "This reply was written by an email agent on Cloudflare.",
  ].join("\n")
}

export class EmailAgent extends Agent<Env, EmailState> {
  override initialState: EmailState = { mails: [] }

  async onEmail(email: AgentEmail) {
    const parsed = await PostalMime.parse(await email.getRaw())
    const subject = parsed.subject ?? "(no subject)"
    const text = parsed.text ?? ""
    const simulated = email.headers.get("x-cfas-simulated") === "1"
    this.push({ direction: "in", from: email.from, to: email.to, subject, text, simulated })
    const body = replyText(subject, text)
    await this.replyToEmail(email, { fromName: "cfas email agent", body })
    this.push({
      direction: "out",
      from: email.to,
      to: email.from,
      subject: `Re: ${subject}`,
      text: body,
      simulated,
    })
  }

  @callable()
  async simulate(from: string, subject: string, text: string) {
    const messageId = `<${crypto.randomUUID()}@cfas.example>`
    const raw = new TextEncoder().encode(rawMessage(from, agentAddress, subject, messageId, text))
    const email: AgentEmail = {
      from,
      to: agentAddress,
      headers: new Headers({ subject, "message-id": messageId, "x-cfas-simulated": "1" }),
      rawSize: raw.byteLength,
      getRaw: async () => raw,
      setReject: () => {},
      forward: async () => ({ messageId: crypto.randomUUID() }),
      reply: async () => ({ messageId: crypto.randomUUID() }),
    }
    await this.onEmail(email)
  }

  @callable()
  clear() {
    this.setState({ mails: [] })
  }

  private push(mail: Omit<MailEntry, "id" | "at">) {
    const entry: MailEntry = { ...mail, id: crypto.randomUUID(), at: new Date().toISOString() }
    this.setState({ mails: [entry, ...this.state.mails].slice(0, mailLimit) })
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (await routeAgentRequest(request, env)) ?? new Response("Not found", { status: 404 })
  },
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    await routeAgentEmail(message, env, {
      resolver: createCatchAllEmailResolver("EmailAgent", inboxName),
    })
  },
} satisfies ExportedHandler<Env>
