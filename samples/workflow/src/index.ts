import { Agent, callable, routeAgentRequest } from "agents"
import { AgentWorkflow, type AgentWorkflowEvent, type AgentWorkflowStep } from "agents/workflows"
import * as z from "zod"
import type { Progress, Run, WorkflowState } from "./types.ts"

const progressSchema = z.object({
  step: z.string(),
  message: z.string(),
  percent: z.number(),
  waiting: z.boolean().optional(),
})

type Params = { title: string }

const runLimit = 20

export class WorkflowAgent extends Agent<Env, WorkflowState> {
  override initialState: WorkflowState = { runs: [] }

  @callable()
  async start(title: string): Promise<string> {
    const id = await this.runWorkflow("APPROVAL_WORKFLOW", { title } satisfies Params)
    const now = new Date().toISOString()
    const run: Run = {
      id,
      title,
      status: "running",
      step: "queued",
      message: "Queued",
      percent: 0,
      result: null,
      startedAt: now,
      updatedAt: now,
    }
    this.setState({ runs: [run, ...this.state.runs].slice(0, runLimit) })
    return id
  }

  @callable()
  async approve(id: string) {
    await this.approveWorkflow(id, {
      reason: "Approved in the dashboard",
      metadata: { approvedAt: new Date().toISOString() },
    })
  }

  @callable()
  async reject(id: string) {
    await this.rejectWorkflow(id, { reason: "Rejected in the dashboard" })
  }

  @callable()
  clear() {
    this.setState({
      runs: this.state.runs.filter((run) => run.status === "running" || run.status === "waiting"),
    })
  }

  override async onWorkflowProgress(_name: string, id: string, progress: unknown) {
    const p = progressSchema.parse(progress)
    this.update(id, {
      status: p.waiting === true ? "waiting" : "running",
      step: p.step,
      message: p.message,
      percent: p.percent,
    })
  }

  override async onWorkflowComplete(_name: string, id: string, result?: unknown) {
    this.update(id, {
      status: "complete",
      step: "done",
      message: "Completed",
      percent: 1,
      result: JSON.stringify(result ?? null),
    })
  }

  override async onWorkflowError(_name: string, id: string, error: string) {
    const rejected = /reject/i.test(error)
    this.update(id, { status: rejected ? "rejected" : "errored", message: error })
  }

  private update(id: string, patch: Partial<Run>) {
    const updatedAt = new Date().toISOString()
    this.setState({
      runs: this.state.runs.map((run) => (run.id === id ? { ...run, ...patch, updatedAt } : run)),
    })
  }
}

export class ApprovalWorkflow extends AgentWorkflow<WorkflowAgent, Params> {
  override async run(event: AgentWorkflowEvent<Params>, step: AgentWorkflowStep) {
    const report = (progress: Progress) => this.reportProgress(progress)

    await report({ step: "draft", message: "Drafting", percent: 0.1 })
    const draft = await step.do("draft", async () => {
      await scheduler.wait(1500)
      return `Draft for "${event.payload.title}"`
    })

    await report({ step: "review", message: "Checking the draft", percent: 0.4 })
    const words = await step.do("review", async () => {
      await scheduler.wait(1500)
      return draft.split(/\s+/).length
    })

    await report({ step: "approval", message: "Waiting for approval", percent: 0.6, waiting: true })
    const approval = await this.waitForApproval<{ reason?: string }>(step, { timeout: "1 hour" })

    await report({ step: "publish", message: "Publishing", percent: 0.8 })
    const published = await step.do("publish", async () => {
      await scheduler.wait(1000)
      return { draft, words, approval, publishedAt: new Date().toISOString() }
    })

    await step.reportComplete(published)
    return published
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (await routeAgentRequest(request, env)) ?? new Response("Not found", { status: 404 })
  },
} satisfies ExportedHandler<Env>
