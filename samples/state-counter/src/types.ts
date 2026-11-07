export type CounterState = {
  count: number
  updatedAt: string | null
}

export type HistoryRow = {
  id: number
  delta: number
  count: number
  at: string
}
