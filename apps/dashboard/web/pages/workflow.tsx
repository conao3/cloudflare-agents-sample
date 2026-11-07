import type { Run, WorkflowState } from "@cfas/workflow/types"
import { useAgent } from "agents/react"
import { useState } from "react"
import { Button, Card, ConnectionBadge, Field, formatTime, inputClass } from "../ui.tsx"

const statusClass: Record<Run["status"], string> = {
  running: "bg-blue-100 text-blue-800",
  waiting: "bg-amber-100 text-amber-800",
  complete: "bg-green-100 text-green-800",
  rejected: "bg-zinc-200 text-zinc-700",
  errored: "bg-red-100 text-red-800",
}

export const WorkflowPage = () => {
  const agent = useAgent<WorkflowState>({ agent: "workflow-agent", name: "default" })
  const connected = agent.identified
  const runs = agent.state?.runs ?? []
  const [title, setTitle] = useState("Weekly report")
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const act = async (key: string, method: string, args: unknown[]) => {
    setBusy(key)
    setError(null)
    try {
      await agent.call(method, args)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  const startReason = !connected
    ? "Waiting for the WebSocket connection"
    : busy !== null
      ? "Running"
      : title.trim() === ""
        ? "Enter a title"
        : undefined
  const finished = runs.filter((r) => r.status !== "running" && r.status !== "waiting").length

  return (
    <div className="flex flex-col gap-4">
      <Card title="Start a workflow">
        <div className="mb-3">
          <ConnectionBadge connected={connected} />
        </div>
        <div className="flex items-end gap-2">
          <Field label="Title (payload)">
            <input
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Button
            onClick={() => void act("start", "start", [title.trim()])}
            disabled={startReason !== undefined}
            disabledReason={startReason}
          >
            Start
          </Button>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Steps: draft → review → wait for approval (up to 1 hour) → publish. Each{" "}
          <code>step.do</code> is retried and its result is persisted, so the workflow survives
          restarts.
        </p>
        {error !== null && <p className="mt-2 text-sm text-red-700">{error}</p>}
      </Card>
      <Card title={`Runs (${runs.length})`}>
        <div className="mb-2 flex justify-end">
          <Button
            tone="secondary"
            onClick={() => void act("clear", "clear", [])}
            disabled={finished === 0 || busy !== null}
            disabledReason={busy !== null ? "Running" : "No finished runs to clear"}
          >
            Clear finished
          </Button>
        </div>
        {runs.length === 0 ? (
          <p className="text-sm text-zinc-500">No runs yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {runs.map((run) => (
              <li key={run.id} className="rounded-md border border-zinc-200 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-medium text-zinc-900">{run.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass[run.status]}`}>
                    {run.status}
                  </span>
                  <span className="ml-auto text-xs text-zinc-500">
                    started {formatTime(run.startedAt)}
                  </span>
                </div>
                <div className="mb-1 h-1.5 overflow-hidden rounded bg-zinc-100">
                  <div
                    className="h-full bg-orange-500 transition-all"
                    style={{ width: `${Math.round(run.percent * 100)}%` }}
                  />
                </div>
                <p className="text-sm text-zinc-700">
                  <code className="text-xs">{run.step}</code> {run.message}
                </p>
                {run.result !== null && (
                  <pre className="mt-2 overflow-x-auto rounded bg-zinc-50 p-2 text-xs text-zinc-600">
                    {run.result}
                  </pre>
                )}
                {run.status === "waiting" && (
                  <div className="mt-2 flex gap-2">
                    <Button
                      onClick={() => void act(run.id, "approve", [run.id])}
                      disabled={busy !== null}
                      disabledReason="Running"
                    >
                      Approve
                    </Button>
                    <Button
                      tone="danger"
                      onClick={() => void act(run.id, "reject", [run.id])}
                      disabled={busy !== null}
                      disabledReason="Running"
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
