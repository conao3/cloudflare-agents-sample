import {
  fiberMs,
  scheduleDelaySeconds,
  type ObsEvent,
  type ObservabilityState,
} from "@cfas/observability/types"
import { useAgent } from "agents/react"
import { useState } from "react"
import * as z from "zod"
import { Button, Card, ConnectionBadge } from "../ui.tsx"

const messageSchema = z.object({
  kind: z.literal("obs"),
  event: z.object({
    type: z.string(),
    agent: z.string().optional(),
    name: z.string().optional(),
    payload: z.record(z.string(), z.unknown()),
    timestamp: z.number(),
  }),
})

type Entry = ObsEvent & { seq: number }

const eventLimit = 200

const category = (type: string) => type.split(":")[0] ?? type

const categoryClass: Record<string, string> = {
  rpc: "bg-blue-100 text-blue-800",
  state: "bg-green-100 text-green-800",
  schedule: "bg-purple-100 text-purple-800",
  queue: "bg-amber-100 text-amber-800",
  fiber: "bg-cyan-100 text-cyan-800",
  connect: "bg-zinc-100 text-zinc-700",
  disconnect: "bg-zinc-100 text-zinc-700",
}

type Action = {
  key: string
  label: string
  method: string
  expect: string
  tone?: "primary" | "secondary" | "danger"
}

const actions: Action[] = [
  { key: "bump", label: "setState", method: "bump", expect: "rpc, state:update" },
  { key: "ping", label: "Call RPC", method: "ping", expect: "rpc" },
  {
    key: "schedule",
    label: `Schedule in ${scheduleDelaySeconds} s`,
    method: "scheduleTick",
    expect: "schedule:create, then schedule:execute and state:update",
  },
  {
    key: "queue",
    label: "Queue a job",
    method: "queueJob",
    expect: "queue:create, then state:update when it runs",
  },
  {
    key: "fiber",
    label: `Run a ${fiberMs / 1000} s fiber`,
    method: "runShortFiber",
    expect: "fiber:run:started, fiber:run:completed",
  },
  { key: "fail", label: "Throw an error", method: "fail", expect: "rpc:error", tone: "danger" },
]

export const ObservabilityPage = () => {
  const [events, setEvents] = useState<Entry[]>([])
  const [filter, setFilter] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const agent = useAgent<ObservabilityState>({
    agent: "observability-agent",
    name: "default",
    onMessage: (message: MessageEvent) => {
      if (typeof message.data !== "string" || !message.data.startsWith("{")) return
      const parsed = messageSchema.safeParse(JSON.parse(message.data))
      if (!parsed.success) return
      setEvents((prev) =>
        [{ ...parsed.data.event, seq: (prev[0]?.seq ?? 0) + 1 }, ...prev].slice(0, eventLimit),
      )
    },
  })
  const connected = agent.identified
  const state = agent.state

  const run = async (action: Action) => {
    setBusy(action.key)
    setResult(null)
    try {
      const value: unknown = await agent.call(action.method, [])
      setResult({
        ok: true,
        text: `${action.method}() returned ${JSON.stringify(value ?? null)}. Expect ${action.expect}.`,
      })
    } catch (e) {
      setResult({
        ok: false,
        text: `${action.method}() threw: ${e instanceof Error ? e.message : String(e)}. Expect ${action.expect}.`,
      })
    } finally {
      setBusy(null)
    }
  }

  const categories = [...new Set(events.map((e) => category(e.type)))].toSorted()
  const shown = filter === null ? events : events.filter((e) => category(e.type) === filter)

  return (
    <div className="flex flex-col gap-4">
      <Card title="Trigger events">
        <div className="mb-3 flex items-center gap-3">
          <ConnectionBadge connected={connected} />
          {state !== undefined && (
            <span className="text-xs text-zinc-500">
              counter {state.counter} · ticks {state.ticks} · jobs {state.jobs} · fibers{" "}
              {state.fibers}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action.key}
              tone={action.tone ?? "primary"}
              onClick={() => void run(action)}
              disabled={!connected || busy !== null}
              disabledReason={!connected ? "Waiting for the WebSocket connection" : "Running"}
            >
              {busy === action.key ? "Running…" : action.label}
            </Button>
          ))}
        </div>
        {result !== null && (
          <p className={`mt-3 text-sm ${result.ok ? "text-zinc-700" : "text-red-700"}`}>
            {result.text}
          </p>
        )}
        <p className="mt-3 text-xs text-zinc-500">
          The agent overrides <code>observability</code>: each event still goes to{" "}
          <code>genericObservability</code> (diagnostics channels, Tail Workers) and is also sent to
          every connected tab with <code>this.broadcast</code>. Deployed, the sample has Workers
          Logs on, so <code>console.log</code> output and invocations show in the Cloudflare
          dashboard under Workers &amp; Pages → cfas-observability → Logs.
        </p>
      </Card>
      <Card title={`Events (${shown.length} of ${events.length})`}>
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilter(null)}
            className={`rounded-full px-2 py-0.5 text-xs ${filter === null ? "bg-orange-500 text-white" : "bg-zinc-100 text-zinc-700"}`}
          >
            all
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setFilter(c)}
              className={`rounded-full px-2 py-0.5 text-xs ${filter === c ? "bg-orange-500 text-white" : "bg-zinc-100 text-zinc-700"}`}
            >
              {c} {events.filter((e) => category(e.type) === c).length}
            </button>
          ))}
          <span className="ml-auto">
            <Button
              tone="secondary"
              onClick={() => {
                setEvents([])
                setFilter(null)
              }}
              disabled={events.length === 0}
              disabledReason="The log is empty"
            >
              Clear log
            </Button>
          </span>
        </div>
        {shown.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No events yet. Press a button above; connecting this tab already emits{" "}
            <code>connect</code>.
          </p>
        ) : (
          <ul className="flex flex-col gap-1 font-mono text-xs">
            {shown.map((e) => (
              <li
                key={e.seq}
                className="flex items-start gap-2 border-b border-zinc-100 py-1 last:border-0"
              >
                <span className="shrink-0 text-zinc-400">
                  {new Date(e.timestamp).toLocaleTimeString()}
                </span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 ${categoryClass[category(e.type)] ?? "bg-zinc-100 text-zinc-700"}`}
                >
                  {e.type}
                </span>
                <span className="shrink-0 text-zinc-500">
                  {e.agent ?? "?"}/{e.name ?? "?"}
                </span>
                <span className="break-all text-zinc-700">{JSON.stringify(e.payload)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
