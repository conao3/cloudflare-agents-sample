import { Agent, callable, routeAgentRequest } from "agents"
import { genericObservability, type Observability } from "agents/observability"
import { fiberMs, scheduleDelaySeconds, type ObservabilityState, type ObsMessage } from "./types.ts"

export class ObservabilityAgent extends Agent<Env, ObservabilityState> {
  override initialState: ObservabilityState = { counter: 0, ticks: 0, jobs: 0, fibers: 0 }

  override observability: Observability = {
    emit: (event) => {
      genericObservability.emit(event)
      this.broadcast(JSON.stringify({ kind: "obs", event } satisfies ObsMessage))
    },
  }

  @callable()
  bump(): number {
    const counter = this.state.counter + 1
    this.setState({ ...this.state, counter })
    return counter
  }

  @callable()
  ping(): string {
    return new Date().toISOString()
  }

  @callable()
  async scheduleTick(): Promise<string> {
    const schedule = await this.schedule(scheduleDelaySeconds, "tick", { from: "dashboard" })
    return schedule.id
  }

  async tick() {
    console.log("Scheduled tick ran")
    this.setState({ ...this.state, ticks: this.state.ticks + 1 })
  }

  @callable()
  async queueJob(): Promise<string> {
    return this.queue("work", { from: "dashboard" })
  }

  async work() {
    console.log("Queued job ran")
    this.setState({ ...this.state, jobs: this.state.jobs + 1 })
  }

  @callable()
  async runShortFiber(): Promise<number> {
    await this.runFiber("short", async (ctx) => {
      ctx.stash({ startedAt: Date.now() })
      await scheduler.wait(fiberMs)
    })
    const fibers = this.state.fibers + 1
    this.setState({ ...this.state, fibers })
    return fibers
  }

  @callable()
  fail(): never {
    throw new Error("fail() throws on purpose")
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (await routeAgentRequest(request, env)) ?? new Response("Not found", { status: 404 })
  },
} satisfies ExportedHandler<Env>
