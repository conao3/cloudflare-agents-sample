export type RunStatus = "running" | "waiting" | "complete" | "rejected" | "errored"

export type Run = {
  id: string
  title: string
  status: RunStatus
  step: string
  message: string
  percent: number
  result: string | null
  startedAt: string
  updatedAt: string
}

export type WorkflowState = {
  runs: Run[]
}

export type Progress = {
  step: string
  message: string
  percent: number
  waiting?: boolean
}
