import { Agent, callable, getAgentByName, routeAgentRequest } from "agents"
import * as z from "zod"
import { repoAgentName, webhookPath, type RepoEvent, type RepoState } from "./types.ts"

const eventLimit = 100

const user = z.object({ login: z.string() })

const repository = z.object({
  full_name: z.string(),
  html_url: z.string(),
  stargazers_count: z.number(),
  forks_count: z.number(),
  open_issues_count: z.number(),
})

const envelope = z.object({
  action: z.string().optional(),
  repository,
  sender: user.optional(),
})

const ping = z.object({ zen: z.string(), hook_id: z.number() })

const push = z.object({
  ref: z.string(),
  compare: z.string().optional(),
  commits: z.array(z.object({ message: z.string(), url: z.string() })),
})

const pullRequest = z.object({
  number: z.number(),
  pull_request: z.object({
    title: z.string(),
    html_url: z.string(),
    merged: z.boolean().optional(),
  }),
})

const issues = z.object({
  issue: z.object({ number: z.number(), title: z.string(), html_url: z.string() }),
})

const issueComment = z.object({
  issue: z.object({ number: z.number(), title: z.string() }),
  comment: z.object({ body: z.string(), html_url: z.string() }),
})

const fork = z.object({ forkee: z.object({ full_name: z.string(), html_url: z.string() }) })

const release = z.object({
  release: z.object({ tag_name: z.string(), name: z.string().nullable(), html_url: z.string() }),
})

type Envelope = z.infer<typeof envelope>

type Summary = Pick<RepoEvent, "title" | "detail" | "url">

const firstLine = (text: string): string => text.split("\n")[0] ?? ""

const clip = (text: string, length: number): string =>
  text.length > length ? `${text.slice(0, length)}…` : text

const summarize = (type: string, payload: unknown, env: Envelope): Summary => {
  const action = env.action ?? ""
  const repoUrl = env.repository.html_url
  if (type === "ping") {
    const p = ping.parse(payload)
    return { title: `Webhook ${p.hook_id} configured`, detail: p.zen, url: repoUrl }
  }
  if (type === "push") {
    const p = push.parse(payload)
    const branch = p.ref.replace(/^refs\/(heads|tags)\//, "")
    const count = p.commits.length
    return {
      title: `Pushed ${count} commit${count === 1 ? "" : "s"} to ${branch}`,
      detail: firstLine(p.commits[0]?.message ?? ""),
      url: p.compare ?? p.commits[0]?.url ?? repoUrl,
    }
  }
  if (type === "pull_request") {
    const p = pullRequest.parse(payload)
    const verb = action === "closed" && p.pull_request.merged === true ? "merged" : action
    return {
      title: `PR #${p.number} ${verb}`,
      detail: p.pull_request.title,
      url: p.pull_request.html_url,
    }
  }
  if (type === "issues") {
    const p = issues.parse(payload)
    return {
      title: `Issue #${p.issue.number} ${action}`,
      detail: p.issue.title,
      url: p.issue.html_url,
    }
  }
  if (type === "issue_comment") {
    const p = issueComment.parse(payload)
    return {
      title: `Comment ${action} on #${p.issue.number}`,
      detail: clip(firstLine(p.comment.body), 140),
      url: p.comment.html_url,
    }
  }
  if (type === "star") {
    return { title: action === "deleted" ? "Star removed" : "Starred", detail: "", url: repoUrl }
  }
  if (type === "watch") {
    return { title: "Watching (starred)", detail: "", url: repoUrl }
  }
  if (type === "fork") {
    const p = fork.parse(payload)
    return { title: "Forked", detail: p.forkee.full_name, url: p.forkee.html_url }
  }
  if (type === "release") {
    const p = release.parse(payload)
    return {
      title: `Release ${p.release.tag_name} ${action}`,
      detail: p.release.name ?? "",
      url: p.release.html_url,
    }
  }
  return { title: action === "" ? type : `${type} ${action}`, detail: "", url: repoUrl }
}

type EventRow = {
  id: string
  delivery: string | null
  type: string
  action: string | null
  title: string
  detail: string
  url: string | null
  actor: string | null
  received_at: string
}

export class RepoAgent extends Agent<Env, RepoState> {
  override initialState: RepoState = {
    repo: null,
    stats: null,
    events: 0,
    lastEvent: null,
    updatedAt: null,
  }

  override onStart() {
    void this.sql`create table if not exists events (
      id text primary key,
      delivery text,
      type text not null,
      action text,
      title text not null,
      detail text not null,
      url text,
      actor text,
      received_at text not null
    )`
  }

  async receive(type: string, delivery: string | null, body: string): Promise<RepoEvent> {
    const payload: unknown = JSON.parse(body)
    const env = envelope.parse(payload)
    const summary = summarize(type, payload, env)
    const event: RepoEvent = {
      id: crypto.randomUUID(),
      delivery,
      type,
      action: env.action ?? null,
      ...summary,
      actor: env.sender?.login ?? null,
      receivedAt: new Date().toISOString(),
    }
    void this.sql`insert into events (id, delivery, type, action, title, detail, url, actor, received_at)
      values (${event.id}, ${event.delivery}, ${event.type}, ${event.action}, ${event.title}, ${event.detail}, ${event.url}, ${event.actor}, ${event.receivedAt})`
    void this.sql`delete from events where id not in (
      select id from events order by received_at desc limit ${eventLimit}
    )`
    this.setState({
      repo: env.repository.full_name,
      stats: {
        stars: env.repository.stargazers_count,
        forks: env.repository.forks_count,
        openIssues: env.repository.open_issues_count,
      },
      events: this.count(),
      lastEvent: { type, at: event.receivedAt },
      updatedAt: event.receivedAt,
    })
    return event
  }

  @callable()
  listEvents(limit: number): RepoEvent[] {
    return this.sql<EventRow>`select * from events order by received_at desc limit ${limit}`.map(
      (row) => ({
        id: row.id,
        delivery: row.delivery,
        type: row.type,
        action: row.action,
        title: row.title,
        detail: row.detail,
        url: row.url,
        actor: row.actor,
        receivedAt: row.received_at,
      }),
    )
  }

  @callable()
  clearEvents() {
    void this.sql`delete from events`
    this.setState({ ...this.state, events: 0, updatedAt: new Date().toISOString() })
  }

  private count(): number {
    return this.sql<{ n: number }>`select count(*) as n from events`[0]?.n ?? 0
  }
}

const hexToBytes = (hex: string): Uint8Array<ArrayBuffer> | null => {
  if (!/^([0-9a-f]{2})+$/i.test(hex)) return null
  return new Uint8Array(hex.match(/../g)?.map((pair) => Number.parseInt(pair, 16)) ?? [])
}

const verifySignature = async (secret: string, body: string, header: string | null) => {
  const signature = hexToBytes(header?.replace(/^sha256=/, "") ?? "")
  if (header === null || !header.startsWith("sha256=") || signature === null) return false
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(body)))
  return (
    signature.byteLength === expected.byteLength &&
    crypto.subtle.timingSafeEqual(signature, expected)
  )
}

const handleWebhook = async (request: Request, env: Env): Promise<Response> => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 })
  const secret = env.GITHUB_WEBHOOK_SECRET
  if (secret === undefined || secret === "") {
    return new Response("GITHUB_WEBHOOK_SECRET is not set", { status: 500 })
  }
  const body = await request.text()
  if (!(await verifySignature(secret, body, request.headers.get("x-hub-signature-256")))) {
    return new Response("Invalid signature", { status: 401 })
  }
  const type = request.headers.get("x-github-event")
  if (type === null) return new Response("Missing X-GitHub-Event", { status: 400 })
  const parsed = envelope.safeParse(JSON.parse(body))
  if (!parsed.success) return new Response("Payload has no repository", { status: 400 })
  const agent = await getAgentByName(env.RepoAgent, repoAgentName(parsed.data.repository.full_name))
  const event = await agent.receive(type, request.headers.get("x-github-delivery"), body)
  return Response.json({ ok: true, agent: repoAgentName(parsed.data.repository.full_name), event })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname === webhookPath) return handleWebhook(request, env)
    return (await routeAgentRequest(request, env)) ?? new Response("Not found", { status: 404 })
  },
} satisfies ExportedHandler<Env>
