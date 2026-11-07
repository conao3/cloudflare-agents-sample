export type Note = {
  id: string
  url: string
  summary: string
  at: string
  ok: boolean
}

export type ResearchState = {
  notes: Note[]
}

export type Watch = {
  id: string
  url: string
  intervalMinutes: number
  nextAt: number
}
