export type BrowserAction = "markdown" | "links" | "screenshot" | "ask"

export type BrowserLogEntry = {
  action: BrowserAction
  url: string
  ok: boolean
  ms: number
  at: string
}

export type BrowserState = {
  log: BrowserLogEntry[]
}

export type AskResult = {
  answer: string
  toolsUsed: string[]
}
