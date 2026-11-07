export type TaskSummary = {
  submissionId: string
  status: "pending" | "running" | "completed" | "aborted" | "skipped" | "error"
  prompt: string
  createdAt: number
  completedAt: number | null
  error: string | null
}

export type WorkspaceFile = {
  path: string
  size: number
}
