import { agentAddress, inboxName, type EmailState } from "@cfas/email/types"
import { useAgent } from "agents/react"
import { useState } from "react"
import { Button, Card, ConnectionBadge, Field, formatTime, inputClass } from "../ui.tsx"

export const EmailPage = () => {
  const agent = useAgent<EmailState>({ agent: "email-agent", name: inboxName })
  const connected = agent.identified
  const mails = agent.state?.mails ?? []
  const [from, setFrom] = useState("alice@example.com")
  const [subject, setSubject] = useState("Question about my order")
  const [text, setText] = useState("Hi, when will my order ship? Thanks.")
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
      ? "Sending"
      : !from.includes("@")
        ? "Enter a sender address"
        : undefined

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Send a simulated email">
        <div className="mb-3">
          <ConnectionBadge connected={connected} />
        </div>
        <div className="flex flex-col gap-2">
          <Field label="From">
            <input className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label={`To: ${agentAddress}`}>
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
        {error !== null && <p className="mt-2 text-sm text-red-700">{error}</p>}
        <p className="mt-3 text-xs text-zinc-500">
          The message goes through the same <code>onEmail</code> and <code>replyToEmail</code> code
          as real mail. Real mail arrives through Email Routing and the Worker's{" "}
          <code>email()</code> handler.
        </p>
      </Card>
      <Card title={`Mailbox (${mails.length})`}>
        <div className="mb-2 flex justify-end">
          <Button
            tone="secondary"
            onClick={() => void act("clear", [])}
            disabled={mails.length === 0 || busy}
            disabledReason={busy ? "Sending" : "The mailbox is empty"}
          >
            Clear
          </Button>
        </div>
        {mails.length === 0 ? (
          <p className="text-sm text-zinc-500">No mail yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {mails.map((mail) => (
              <li
                key={mail.id}
                className={`rounded-md border p-2 text-sm ${mail.direction === "in" ? "border-zinc-200" : "border-orange-200 bg-orange-50"}`}
              >
                <div className="flex gap-2 text-xs text-zinc-500">
                  <span>{mail.direction === "in" ? "Received" : "Replied"}</span>
                  <span>{formatTime(mail.at)}</span>
                  {mail.simulated && <span>simulated</span>}
                </div>
                <div className="text-xs text-zinc-600">
                  {mail.from} → {mail.to}
                </div>
                <div className="font-medium text-zinc-900">{mail.subject}</div>
                <p className="whitespace-pre-wrap text-zinc-700">{mail.text}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
