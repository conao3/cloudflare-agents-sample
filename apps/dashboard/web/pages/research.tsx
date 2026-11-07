import type { ResearchState, Watch } from "@cfas/research/types"
import { useAgent } from "agents/react"
import { useCallback, useEffect, useState } from "react"
import { ChatView } from "../chat-view.tsx"
import { Button, Card, formatTime } from "../ui.tsx"

const Side = () => {
  const agent = useAgent<ResearchState>({ agent: "research-agent", name: "default" })
  const notes = agent.state?.notes ?? []
  const [watches, setWatches] = useState<Watch[]>([])
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    setWatches(await agent.call<Watch[]>("watches", []))
  }, [agent])
  useEffect(() => {
    if (agent.identified) void load()
  }, [agent.identified, notes.length, load])
  const act = async (method: string, args: unknown[]) => {
    setBusy(true)
    try {
      await agent.call(method, args)
      await load()
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-col gap-4">
      <Card title={`Watched pages (${watches.length})`}>
        {watches.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Ask the assistant to watch a page, for example every 60 minutes.
          </p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {watches.map((w) => (
              <li key={w.id} className="flex items-center gap-2">
                <span className="truncate text-zinc-800">{w.url}</span>
                <span className="text-xs text-zinc-500">every {w.intervalMinutes} min</span>
                <span className="ml-auto">
                  <Button
                    tone="danger"
                    onClick={() => void act("unwatch", [w.id])}
                    disabled={busy}
                    disabledReason="Saving"
                  >
                    Stop
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title={`Notes (${notes.length})`}>
        <div className="mb-2 flex justify-end">
          <Button
            tone="secondary"
            onClick={() => void act("clearNotes", [])}
            disabled={notes.length === 0 || busy}
            disabledReason={busy ? "Saving" : "No notes to clear"}
          >
            Clear
          </Button>
        </div>
        {notes.length === 0 ? (
          <p className="text-sm text-zinc-500">Each scheduled re-read adds a summary here.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {notes.map((n) => (
              <li key={n.id} className="rounded border border-zinc-200 p-2">
                <div className="flex gap-2 text-xs text-zinc-500">
                  <span>{formatTime(n.at)}</span>
                  <span className="truncate">{n.url}</span>
                </div>
                <p className={n.ok ? "text-zinc-800" : "text-red-700"}>{n.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

export const ResearchPage = () => (
  <ChatView
    agentName="research-agent"
    instance="default"
    suggestions={[
      "Summarize https://developers.cloudflare.com/agents/ in three bullet points.",
      "Watch https://developers.cloudflare.com/changelog/ every 60 minutes.",
    ]}
    side={<Side />}
  />
)
