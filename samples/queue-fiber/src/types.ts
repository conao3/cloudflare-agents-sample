export const failureModes = ["none", "first", "always"] as const

export type FailureMode = (typeof failureModes)[number]

export const maxAttempts = 3

export type JobStatus = "pending" | "running" | "retrying" | "done" | "failed" | "removed"

export type Job = {
  id: string
  label: string
  failure: FailureMode
  status: JobStatus
  attempts: number
  error: string | null
  queuedAt: string
  updatedAt: string
}

export type CountStatus = "running" | "completed" | "cancelled"

export type Checkpoint = {
  countId: string
  step: number
  total: number
  stashedAt: string
}

export type Count = {
  id: string
  fiberId: string
  status: CountStatus
  step: number
  total: number
  stepMs: number
  checkpoint: Checkpoint | null
  resumes: number
  startedAt: string
  updatedAt: string
}

export type Recovery = {
  fiberId: string
  name: string
  snapshot: Checkpoint | null
  resumedAs: string | null
  recoveredAt: string
}

export type QueueFiberState = {
  jobs: Job[]
  count: Count | null
  recoveries: Recovery[]
}

export const countSteps = 20

export const countStepMs = 3000
