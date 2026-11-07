import type { ScheduleRequest, SchedulerState } from "@cfas/scheduler/types"
import { useAgent } from "agents/react"
import { useCallback, useEffect, useState } from "react"
import { Button, Card, ConnectionBadge, Field, formatTime, inputClass } from "../ui.tsx"

type Kind = ScheduleRequest["kind"]

type ScheduleRow = {
  id: string
  type: Kind
  time: number
  payload: string
  cron?: string
  intervalSeconds?: number
  delayInSeconds?: number
}

const kinds: { kind: Kind; label: string; hint: string }[] = [
  { kind: "delayed", label: "Delay", hint: "Seconds from now" },
  { kind: "scheduled", label: "Date", hint: "A local date and time" },
  { kind: "cron", label: "Cron", hint: "Cron expression, UTC" },
  { kind: "interval", label: "Interval", hint: "Every N seconds" },
]

const defaultWhen: Record<Kind, string> = {
  delayed: "5",
  scheduled: "",
  cron: "* * * * *",
  interval: "10",
}

const toRequest = (kind: Kind, when: string, message: string): ScheduleRequest => {
  if (kind === "delayed") return { kind, seconds: Number(when), message }
  if (kind === "scheduled") return { kind, at: new Date(when).toISOString(), message }
  if (kind === "cron") return { kind, cron: when, message }
  return { kind, seconds: Number(when), message }
}

const whenError = (kind: Kind, when: string): string | null => {
  if (when.trim() === "") return "Enter when to run"
  if ((kind === "delayed" || kind === "interval") && !(Number(when) > 0))
    return "Enter a positive number"
  if (kind === "scheduled" && new Date(when).getTime() <= Date.now())
    return "Pick a time in the future"
  return null
}

const describe = (row: ScheduleRow): string => {
  if (row.type === "delayed") return `after ${row.delayInSeconds}s`
  if (row.type === "scheduled") return "at a date"
  if (row.type === "cron") return `cron ${row.cron}`
  return `every ${row.intervalSeconds}s`
}

export const SchedulerPage = () => {
  const agent = useAgent<SchedulerState>({ agent: "scheduler-agent", name: "default" })
  const connected = agent.identified
  const fired = agent.state?.fired ?? []
  const [kind, setKind] = useState<Kind>("delayed")
  const [when, setWhen] = useState(defaultWhen.delayed)
  const [message, setMessage] = useState("hello")
  const [schedules, setSchedules] = useState<ScheduleRow[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSchedules = useCallback(async () => {
    setSchedules(await agent.call<ScheduleRow[]>("list", []))
  }, [agent])

  useEffect(() => {
    if (connected) {
      void loadSchedules()
    }
  }, [connected, fired.length, fired[0]?.firedAt, loadSchedules])

  const act = async (method: string, args: unknown[]) => {
    setBusy(true)
    setError(null)
    try {
      await agent.call(method, args)
      await loadSchedules()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const invalid = whenError(kind, when)
  const addReason = !connected
    ? "Waiting for the WebSocket connection"
    : busy
      ? "Saving"
      : (invalid ?? undefined)

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Add a schedule">
        <div className="mb-3 flex items-center justify-between">
          <ConnectionBadge connected={connected} />
        </div>
        <div className="mb-3 flex gap-1 rounded-md bg-zinc-100 p-1">
          {kinds.map((k) => (
            <button
              key={k.kind}
              type="button"
              onClick={() => {
                setKind(k.kind)
                setWhen(defaultWhen[k.kind])
              }}
              className={`flex-1 rounded px-2 py-1 text-sm ${kind === k.kind ? "bg-white font-medium text-zinc-900 shadow-sm" : "text-zinc-600"}`}
            >
              {k.label}
            </button>
          ))}
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <Field label={kinds.find((k) => k.kind === kind)?.hint ?? ""}>
            <input
              className={inputClass}
              type={kind === "scheduled" ? "datetime-local" : "text"}
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
          </Field>
          <Field label="Message (payload)">
            <input
              className={inputClass}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </Field>
        </div>
        <Button
          onClick={() => void act("add", [toRequest(kind, when, message)])}
          disabled={addReason !== undefined}
          disabledReason={addReason}
        >
          Add
        </Button>
        {error !== null && <p className="mt-3 text-sm text-red-700">{error}</p>}
      </Card>
      <Card title={`Pending schedules (${schedules.length})`}>
        {schedules.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing scheduled.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {schedules.map((row) => (
              <li key={row.id} className="flex items-center gap-2 text-sm">
                <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">{row.type}</code>
                <span className="text-zinc-800">{row.payload}</span>
                <span className="text-xs text-zinc-500">
                  {describe(row)}, next {formatTime(new Date(row.time * 1000).toISOString())}
                </span>
                <span className="ml-auto">
                  <Button
                    tone="danger"
                    onClick={() => void act("cancel", [row.id])}
                    disabled={busy}
                    disabledReason="Saving"
                  >
                    Cancel
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title={`Runs (${fired.length})`}>
        <div className="mb-2 flex justify-end">
          <Button
            tone="secondary"
            onClick={() => void act("clearFired", [])}
            disabled={fired.length === 0 || busy}
            disabledReason={busy ? "Saving" : "No runs to clear"}
          >
            Clear
          </Button>
        </div>
        {fired.length === 0 ? (
          <p className="text-sm text-zinc-500">No runs yet. Add a 5-second delay and wait.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {fired.map((task) => (
              <li key={`${task.scheduleId}-${task.firedAt}`} className="flex gap-2">
                <span className="tabular-nums text-zinc-500">{formatTime(task.firedAt)}</span>
                <span className="text-zinc-800">{task.message}</span>
                <code className="ml-auto text-xs text-zinc-400">{task.scheduleId.slice(0, 8)}</code>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
