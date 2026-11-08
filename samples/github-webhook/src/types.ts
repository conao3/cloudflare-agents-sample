export const webhookPath = "/webhooks/github"

export const handledEvents = [
  "ping",
  "push",
  "pull_request",
  "issues",
  "issue_comment",
  "star",
  "fork",
  "release",
  "watch",
] as const

export type HandledEvent = (typeof handledEvents)[number]

export const repoAgentName = (fullName: string): string =>
  fullName.trim().toLowerCase().replace("/", "-")

export type RepoEvent = {
  id: string
  delivery: string | null
  type: string
  action: string | null
  title: string
  detail: string
  url: string | null
  actor: string | null
  receivedAt: string
}

export type RepoStats = {
  stars: number
  forks: number
  openIssues: number
}

export type RepoState = {
  repo: string | null
  stats: RepoStats | null
  events: number
  lastEvent: { type: string; at: string } | null
  updatedAt: string | null
}
