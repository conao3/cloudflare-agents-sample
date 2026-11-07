import type { CounterState, HistoryRow } from "@cfas/state-counter/types"
import { useAgent } from "agents/react"
import { useCallback, useEffect, useState } from "react"
import { Button, Card, ConnectionBadge, Field, formatTime, inputClass } from "../ui.tsx"

const Counter = ({ name }: { name: string }) => {
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const agent = useAgent<CounterState>({ agent: "counter-agent", name })
  const connected = agent.identified
  const state = agent.state

  const loadHistory = useCallback(async () => {
    setHistory(await agent.call<HistoryRow[]>("history", [20]))
  }, [agent])

  useEffect(() => {
    if (connected) {
      void loadHistory()
    }
  }, [connected, state?.count, loadHistory])

  const run = (method: string, args: unknown[]) => async () => {
    setError(null)
    try {
      await agent.call(method, args)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const notConnected = "Waiting for the WebSocket connection"

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="State">
        <div className="mb-3 flex items-center justify-between">
          <ConnectionBadge connected={connected} />
          <span className="text-xs text-zinc-500">
            {state?.updatedAt ? `Updated ${formatTime(state.updatedAt)}` : "Never updated"}
          </span>
        </div>
        <div className="mb-4 text-center text-6xl font-semibold tabular-nums text-zinc-900">
          {state?.count ?? "–"}
        </div>
        <div className="flex justify-center gap-2">
          <Button
            tone="secondary"
            onClick={run("add", [-1])}
            disabled={!connected}
            disabledReason={notConnected}
          >
            −1
          </Button>
          <Button onClick={run("add", [1])} disabled={!connected} disabledReason={notConnected}>
            +1
          </Button>
          <Button
            tone="secondary"
            onClick={run("add", [10])}
            disabled={!connected}
            disabledReason={notConnected}
          >
            +10
          </Button>
          <Button
            tone="danger"
            onClick={run("reset", [])}
            disabled={!connected || state?.count === 0}
            disabledReason={connected ? "The count is already 0" : notConnected}
          >
            Reset
          </Button>
        </div>
        {error !== null && <p className="mt-3 text-sm text-red-700">{error}</p>}
        <p className="mt-4 text-xs text-zinc-500">
          Open this page in another tab: the count changes there too, pushed by{" "}
          <code>setState</code>.
        </p>
      </Card>
      <Card title="History (SQLite in the agent)">
        {history.length === 0 ? (
          <p className="text-sm text-zinc-500">No changes yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-zinc-500">
              <tr>
                <th className="pb-1 font-normal">#</th>
                <th className="pb-1 font-normal">Delta</th>
                <th className="pb-1 font-normal">Count</th>
                <th className="pb-1 font-normal">At</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {history.map((row) => (
                <tr key={row.id} className="border-t border-zinc-100">
                  <td className="py-1 text-zinc-500">{row.id}</td>
                  <td className="py-1">{row.delta > 0 ? `+${row.delta}` : row.delta}</td>
                  <td className="py-1">{row.count}</td>
                  <td className="py-1 text-zinc-500">{formatTime(row.at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

export const StateCounterPage = () => {
  const [draft, setDraft] = useState("default")
  const [name, setName] = useState("default")
  return (
    <div className="flex flex-col gap-4">
      <Card title="Agent instance">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setName(draft.trim())
          }}
        >
          <Field label="Name (each name is a separate Durable Object)">
            <input
              className={inputClass}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </Field>
          <Button
            tone="secondary"
            onClick={() => setName(draft.trim())}
            disabled={draft.trim() === "" || draft.trim() === name}
            disabledReason={draft.trim() === "" ? "Enter a name" : "Already connected to this name"}
          >
            Connect
          </Button>
          <span className="ml-auto text-xs text-zinc-500">
            <code>/agents/counter-agent/{name}</code>
          </span>
        </form>
      </Card>
      <Counter key={name} name={name} />
    </div>
  )
}
