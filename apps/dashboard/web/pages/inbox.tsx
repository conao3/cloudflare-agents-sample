import { inboxAddress, inboxName, type InboxState } from "@cfas/inbox/types"
import { useAgent } from "agents/react"
import { useState } from "react"
import { Button, Card, ConnectionBadge, Field, formatTime, inputClass } from "../ui.tsx"

export const InboxPage = () => {
  const agent = useAgent<InboxState>({
    agent: "inbox-agent",
    name: inboxName,
    defaultCallTimeout: 120_000,
  })
  const connected = agent.identified
  const threads = agent.state?.threads ?? []
  const [from, setFrom] = useState("bob@example.com")
  const [subject, setSubject] = useState("Free plan limits")
  const [text, setText] = useState(
    "Hi, how many browser minutes do I get per day on the free plan?",
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const act = async (method: string, args: unknown[]) => {
    setBusy(true)
    setError(null)
    try {
      await agent.call(method, args)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const reason = !connected
    ? "Waiting for the WebSocket connection"
    : busy
      ? "The agent is answering"
      : !from.includes("@")
        ? "Enter a sender address"
        : undefined

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Send a simulated support email">
        <div className="mb-3">
          <ConnectionBadge connected={connected} />
        </div>
        <div className="flex flex-col gap-2">
          <Field label="From">
            <input className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label={`To: ${inboxAddress}`}>
            <input
              className={inputClass}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
            />
          </Field>
          <Field label="Body">
            <textarea
              className={inputClass}
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-3">
          <Button
            onClick={() => void act("simulate", [from, subject, text])}
            disabled={reason !== undefined}
            disabledReason={reason}
          >
            Deliver to the agent
          </Button>
        </div>
        {busy && (
          <p className="mt-2 text-sm text-zinc-500">
            Searching the knowledge base and writing a reply…
          </p>
        )}
        {error !== null && <p className="mt-2 text-sm text-red-700">{error}</p>}
        <p className="mt-3 text-xs text-zinc-500">
          The knowledge base is the RAG sample's documents. Load its sample documents first to get
          grounded answers.
        </p>
      </Card>
      <Card title={`Threads (${threads.length})`}>
        <div className="mb-2 flex justify-end">
          <Button
            tone="secondary"
            onClick={() => void act("clear", [])}
            disabled={threads.length === 0 || busy}
            disabledReason={busy ? "The agent is answering" : "No threads to clear"}
          >
            Clear
          </Button>
        </div>
        {threads.length === 0 ? (
          <p className="text-sm text-zinc-500">No mail yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {threads.map((t) => (
              <li key={t.id} className="rounded-md border border-zinc-200 p-2 text-sm">
                <div className="flex gap-2 text-xs text-zinc-500">
                  <span>{formatTime(t.receivedAt)}</span>
                  <span>{t.from}</span>
                  {t.simulated && <span>simulated</span>}
                </div>
                <div className="font-medium text-zinc-900">{t.subject}</div>
                <p className="mb-2 whitespace-pre-wrap text-zinc-700">{t.text}</p>
                <div className="rounded bg-orange-50 p-2">
                  <p className="whitespace-pre-wrap text-zinc-800">{t.reply}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Sources: {t.sources.length === 0 ? "none" : t.sources.join(", ")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
