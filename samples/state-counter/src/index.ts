import { Agent, callable, routeAgentRequest } from "agents"
import type { CounterState, HistoryRow } from "./types.ts"

export class CounterAgent extends Agent<Env, CounterState> {
  override initialState: CounterState = { count: 0, updatedAt: null }

  override onStart() {
    void this.sql`create table if not exists history (
      id integer primary key autoincrement,
      delta integer not null,
      count integer not null,
      at text not null
    )`
  }

  @callable()
  add(delta: number): number {
    const count = this.state.count + delta
    const at = new Date().toISOString()
    void this.sql`insert into history (delta, count, at) values (${delta}, ${count}, ${at})`
    this.setState({ count, updatedAt: at })
    return count
  }

  @callable()
  reset(): number {
    return this.add(-this.state.count)
  }

  @callable()
  history(limit: number): HistoryRow[] {
    return this
      .sql<HistoryRow>`select id, delta, count, at from history order by id desc limit ${limit}`
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (await routeAgentRequest(request, env)) ?? new Response("Not found", { status: 404 })
  },
} satisfies ExportedHandler<Env>
