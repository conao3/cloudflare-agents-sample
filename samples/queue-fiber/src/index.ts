import {
  Agent,
  callable,
  routeAgentRequest,
  type FiberContext,
  type FiberRecoveryContext,
} from "agents"
import * as z from "zod"
import {
  countStepMs,
  countSteps,
  failureModes,
  maxAttempts,
  type Checkpoint,
  type Count,
  type FailureMode,
  type Job,
  type QueueFiberState,
} from "./types.ts"

type JobPayload = { jobId: string }

class JobError extends Error {
  constructor(
    readonly jobId: string,
    message: string,
  ) {
    super(message)
  }
}

const checkpointSchema = z.object({
  countId: z.string(),
  step: z.number(),
  total: z.number(),
  stashedAt: z.string(),
})

const fiberName = "count"
const jobLimit = 30
const recoveryLimit = 5
const jobMs = 2000

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener("abort", () => {
      clearTimeout(timer)
      resolve()
    })
  })

export class QueueFiberAgent extends Agent<Env, QueueFiberState> {
  static override options = { keepAliveIntervalMs: 2000 }

  override initialState: QueueFiberState = { jobs: [], count: null, recoveries: [] }

  @callable()
  async enqueue(count: number, failure: FailureMode): Promise<string[]> {
    const n = z.number().int().min(1).max(10).parse(count)
    const mode = z.enum(failureModes).parse(failure)
    const now = new Date().toISOString()
    const start = this.state.jobs.length
    const jobs: Job[] = Array.from({ length: n }, (_, i) => ({
      id: crypto.randomUUID(),
      label: `Job ${start + i + 1}`,
      failure: mode,
      status: "pending",
      attempts: 0,
      error: null,
      queuedAt: now,
      updatedAt: now,
    }))
    this.setState({ ...this.state, jobs: [...this.state.jobs, ...jobs].slice(-jobLimit) })
    for (const job of jobs) {
      await this.queue("runJob", { jobId: job.id } satisfies JobPayload, { id: job.id })
    }
    return jobs.map((job) => job.id)
  }

  async runJob(payload: JobPayload) {
    const job = this.state.jobs.find((j) => j.id === payload.jobId)
    if (job === undefined || job.status === "removed") return
    const attempts = job.attempts + 1
    this.updateJob(job.id, { status: "running", attempts, error: null })
    await scheduler.wait(jobMs)
    if (job.failure === "always" || (job.failure === "first" && attempts === 1)) {
      const message = `Attempt ${attempts} of ${maxAttempts} failed`
      this.updateJob(job.id, { status: "retrying", error: message })
      throw new JobError(job.id, message)
    }
    this.updateJob(job.id, { status: "done", error: null })
  }

  override onError(connectionOrError: unknown, error?: unknown): void {
    const e = error ?? connectionOrError
    if (e instanceof JobError) {
      this.updateJob(e.jobId, {
        status: "failed",
        error: `${e.message}; dropped from the queue after ${maxAttempts} attempts`,
      })
      return
    }
    throw e
  }

  @callable()
  async queued(): Promise<string[]> {
    const ids = await Promise.all(
      this.state.jobs.map(async (job) =>
        (await this.getQueue(job.id)) === undefined ? null : job.id,
      ),
    )
    return ids.filter((id) => id !== null)
  }

  @callable()
  async remove(id: string): Promise<boolean> {
    const removed = await this.dequeue(id)
    if (removed) this.updateJob(id, { status: "removed" })
    return removed
  }

  @callable()
  async removeAll(): Promise<number> {
    const removed = await this.dequeueAll()
    const updatedAt = new Date().toISOString()
    this.setState({
      ...this.state,
      jobs: this.state.jobs.map((job) =>
        job.status === "pending" ? { ...job, status: "removed", updatedAt } : job,
      ),
    })
    return removed
  }

  @callable()
  clearJobs() {
    this.setState({
      ...this.state,
      jobs: this.state.jobs.filter((job) => job.status !== "done" && job.status !== "failed"),
    })
  }

  @callable()
  async startCount(): Promise<string> {
    if (this.state.count?.status === "running") throw new Error("A counting job is already running")
    const now = new Date().toISOString()
    const count: Count = {
      id: crypto.randomUUID(),
      fiberId: crypto.randomUUID(),
      status: "running",
      step: 0,
      total: countSteps,
      stepMs: countStepMs,
      checkpoint: null,
      resumes: 0,
      startedAt: now,
      updatedAt: now,
    }
    this.setState({ ...this.state, count })
    await this.startFiber(fiberName, (ctx) => this.countFrom(ctx, count.id, 0), {
      fiberId: count.fiberId,
    })
    return count.fiberId
  }

  @callable()
  async cancelCount(): Promise<boolean> {
    const count = this.state.count
    if (count === null || count.status !== "running") return false
    const cancelled = await this.cancelFiber(count.fiberId, "Cancelled in the dashboard")
    this.updateCount(count.id, { status: "cancelled" })
    return cancelled
  }

  @callable()
  async fibers() {
    const fibers = await this.listFibers({ name: fiberName, limit: 10 })
    return fibers
      .map((f) => ({
        fiberId: f.fiberId,
        status: f.status,
        snapshot: JSON.stringify(f.snapshot ?? null),
        error: f.error ?? null,
        createdAt: f.createdAt,
        settledAt: f.settledAt ?? null,
      }))
      .toSorted((a, b) => b.createdAt - a.createdAt)
  }

  @callable()
  async clearCount(): Promise<number> {
    if (this.state.count?.status === "running") throw new Error("Cancel the running job first")
    const deleted = await this.deleteFibers({
      status: ["completed", "aborted", "error", "interrupted"],
    })
    this.setState({ ...this.state, count: null, recoveries: [] })
    return deleted
  }

  override async onFiberRecovered(ctx: FiberRecoveryContext) {
    if (ctx.name !== fiberName) return
    const snapshot = checkpointSchema.nullable().parse(ctx.snapshot)
    const count = this.state.count
    const resumable = count !== null && count.fiberId === ctx.id && count.status === "running"
    const fiberId = resumable ? crypto.randomUUID() : null
    const recovery = {
      fiberId: ctx.id,
      name: ctx.name,
      snapshot,
      resumedAs: fiberId,
      recoveredAt: new Date().toISOString(),
    }
    this.setState({
      ...this.state,
      recoveries: [recovery, ...this.state.recoveries].slice(0, recoveryLimit),
    })
    if (!resumable || fiberId === null) return
    const from = snapshot?.step ?? 0
    this.updateCount(count.id, { fiberId, step: from, resumes: count.resumes + 1 })
    await this.startFiber(fiberName, (next) => this.countFrom(next, count.id, from), { fiberId })
  }

  private async countFrom(ctx: FiberContext, countId: string, from: number) {
    for (let step = from + 1; step <= countSteps; step++) {
      await wait(countStepMs, ctx.signal)
      if (ctx.signal.aborted) return
      const checkpoint: Checkpoint = {
        countId,
        step,
        total: countSteps,
        stashedAt: new Date().toISOString(),
      }
      ctx.stash(checkpoint)
      this.updateCount(countId, { step, checkpoint })
    }
    this.updateCount(countId, { status: "completed" })
  }

  private updateJob(id: string, patch: Partial<Job>) {
    const updatedAt = new Date().toISOString()
    this.setState({
      ...this.state,
      jobs: this.state.jobs.map((job) => (job.id === id ? { ...job, ...patch, updatedAt } : job)),
    })
  }

  private updateCount(id: string, patch: Partial<Count>) {
    const count = this.state.count
    if (count === null || count.id !== id) return
    this.setState({
      ...this.state,
      count: { ...count, ...patch, updatedAt: new Date().toISOString() },
    })
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (await routeAgentRequest(request, env)) ?? new Response("Not found", { status: 404 })
  },
} satisfies ExportedHandler<Env>
