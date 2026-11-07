import { useAgent, useAgentToolEvents } from "agents/react"
import { useState } from "react"
import { ChatView } from "../chat-view.tsx"
import { Button, Card } from "../ui.tsx"

const statusClass: Record<string, string> = {
  running: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  error: "bg-red-100 text-red-800",
  aborted: "bg-zinc-200 text-zinc-700",
  interrupted: "bg-amber-100 text-amber-800",
}

const Runs = () => {
  const agent = useAgent({ agent: "sub-agents-agent", name: "default" })
  const events = useAgentToolEvents({ agent })
  const runs = Object.values(events.runsById).toSorted((a, b) => b.order - a.order)
  const [busy, setBusy] = useState(false)
  return (
    <Card title={`Helper runs (${runs.length})`}>
      <div className="mb-2 flex justify-end">
        <Button
          tone="secondary"
          onClick={() => {
            setBusy(true)
            void agent.call("clearRuns", []).finally(() => {
              events.resetLocalState()
              setBusy(false)
            })
          }}
          disabled={runs.length === 0 || busy}
          disabledReason={busy ? "Clearing" : "No runs yet"}
        >
          Clear
        </Button>
      </div>
      {runs.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Each research or plan call starts a Researcher or Planner sub-agent with its own model
          loop and storage. A turn that uses both helpers takes a few minutes.
        </p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {runs.map((run) => (
            <li key={run.runId} className="rounded border border-zinc-200 p-2">
              <div className="mb-1 flex items-center gap-2">
                <span className="font-medium text-zinc-900">
                  {run.display?.name ?? run.agentType}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${statusClass[run.status] ?? ""}`}
                >
                  {run.status}
                </span>
              </div>
              <pre className="whitespace-pre-wrap text-xs text-zinc-500">
                {JSON.stringify(run.inputPreview)}
              </pre>
              {run.summary !== undefined && (
                <p className="mt-1 line-clamp-6 whitespace-pre-wrap text-zinc-700">{run.summary}</p>
              )}
              {run.error !== undefined && <p className="mt-1 text-red-700">{run.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export const SubAgentsPage = () => (
  <ChatView
    harness="think"
    agentName="sub-agents-agent"
    instance="default"
    suggestions={[
      "Research what Durable Objects are on developers.cloudflare.com and plan how to learn them in a week.",
      "Plan a small talk about Cloudflare Agents.",
    ]}
    side={<Runs />}
  />
)
