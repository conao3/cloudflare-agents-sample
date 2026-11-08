export type ElicitationValue = string | number | boolean | string[]

export type ElicitationAnswer = {
  action: "accept" | "decline" | "cancel"
  content?: Record<string, ElicitationValue>
}

export type PendingElicitation = {
  type: "mcp-elicitation"
  id: string
  serverId: string
  params: unknown
}

export type ElicitationSettled = {
  type: "mcp-elicitation-settled"
  id: string
}

export const elicitationTimeoutMs = 5 * 60 * 1000
