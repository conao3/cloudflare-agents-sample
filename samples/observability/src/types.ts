export type ObservabilityState = {
  counter: number
  ticks: number
  jobs: number
  fibers: number
}

export type ObsEvent = {
  type: string
  agent?: string
  name?: string
  payload: Record<string, unknown>
  timestamp: number
}

export type ObsMessage = {
  kind: "obs"
  event: ObsEvent
}

export const scheduleDelaySeconds = 3

export const fiberMs = 1000
