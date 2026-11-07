export type GatewayCall = {
  id: string
  question: string
  answer: string
  logId: string | null
  ms: number
  cacheTtl: number
  skipCache: boolean
  at: string
}

export type GatewayLog = {
  cached: boolean
  durationMs: number
  tokensIn: number | null
  tokensOut: number | null
  statusCode: number
  model: string
  provider: string
}

export type GatewayState = {
  calls: GatewayCall[]
}

export const gatewayId = "default"
