export type FiredTask = {
  scheduleId: string
  message: string
  firedAt: string
}

export type SchedulerState = {
  fired: FiredTask[]
}

export type ScheduleRequest =
  | { kind: "delayed"; seconds: number; message: string }
  | { kind: "scheduled"; at: string; message: string }
  | { kind: "cron"; cron: string; message: string }
  | { kind: "interval"; seconds: number; message: string }
