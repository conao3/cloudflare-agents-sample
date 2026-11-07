import { Agent, callable, routeAgentRequest } from "agents"
import type { FiredTask, SchedulerState, ScheduleRequest } from "./types.ts"

const firedLimit = 30

export class SchedulerAgent extends Agent<Env, SchedulerState> {
  override initialState: SchedulerState = { fired: [] }

  @callable()
  async add(request: ScheduleRequest) {
    if (request.kind === "delayed") return this.schedule(request.seconds, "fire", request.message)
    if (request.kind === "scheduled")
      return this.schedule(new Date(request.at), "fire", request.message)
    if (request.kind === "cron")
      return this.schedule(request.cron, "fire", request.message, { idempotent: false })
    return this.scheduleEvery(request.seconds, "fire", request.message)
  }

  @callable()
  list() {
    return this.listSchedules()
  }

  @callable()
  cancel(id: string) {
    return this.cancelSchedule(id)
  }

  @callable()
  clearFired() {
    this.setState({ fired: [] })
  }

  fire(message: string, schedule: { id: string }) {
    const task: FiredTask = { scheduleId: schedule.id, message, firedAt: new Date().toISOString() }
    this.setState({ fired: [task, ...this.state.fired].slice(0, firedLimit) })
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (await routeAgentRequest(request, env)) ?? new Response("Not found", { status: 404 })
  },
} satisfies ExportedHandler<Env>
