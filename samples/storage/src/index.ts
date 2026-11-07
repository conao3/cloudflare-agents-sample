import { Agent, callable, routeAgentRequest } from "agents"
import type { GuestbookEntry, KvEntry, StorageState } from "./types.ts"

const kvPrefix = "note:"

export class StorageAgent extends Agent<Env, StorageState> {
  override initialState: StorageState = { visits: 0 }

  override async onStart() {
    await this.env.DB.prepare(
      "create table if not exists guestbook (id integer primary key autoincrement, author text not null, message text not null, created_at text not null)",
    ).run()
  }

  @callable()
  visit(): number {
    const visits = this.state.visits + 1
    this.setState({ visits })
    return visits
  }

  @callable()
  async sign(author: string, message: string): Promise<GuestbookEntry[]> {
    await this.env.DB.prepare(
      "insert into guestbook (author, message, created_at) values (?, ?, ?)",
    )
      .bind(author.slice(0, 40), message.slice(0, 280), new Date().toISOString())
      .run()
    return this.guestbook()
  }

  @callable()
  async guestbook(): Promise<GuestbookEntry[]> {
    const { results } = await this.env.DB.prepare(
      "select id, author, message, created_at as createdAt from guestbook order by id desc limit 20",
    ).all<GuestbookEntry>()
    return results
  }

  @callable()
  async putNote(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.env.KV.put(`${kvPrefix}${key}`, value, {
      expirationTtl: Math.max(60, ttlSeconds),
      metadata: { expiresAt: Date.now() + Math.max(60, ttlSeconds) * 1000 },
    })
  }

  @callable()
  async notes(): Promise<KvEntry[]> {
    const list = await this.env.KV.list<{ expiresAt: number }>({ prefix: kvPrefix, limit: 20 })
    return Promise.all(
      list.keys.map(async (k) => ({
        key: k.name.slice(kvPrefix.length),
        value: await this.env.KV.get(k.name),
        expiresAt: k.metadata?.expiresAt ?? null,
      })),
    )
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (await routeAgentRequest(request, env)) ?? new Response("Not found", { status: 404 })
  },
} satisfies ExportedHandler<Env>
