import type { CrossDomainState } from "@cfas/cross-domain/types"
import { useAgent } from "agents/react"
import { useState } from "react"
import * as z from "zod"
import { Button, Card, ConnectionBadge, Field, formatTime, inputClass } from "../ui.tsx"

const otherHostname = window.location.hostname === "localhost" ? "127.0.0.1" : "localhost"
const otherHost = `${otherHostname}${window.location.port === "" ? "" : `:${window.location.port}`}`
const otherOrigin = `${window.location.protocol}//${otherHost}`
const agentUrl = `${otherOrigin}/agents/cross-domain-agent/default`

const httpVisit = z.object({
  origin: z.string(),
  via: z.string(),
  at: z.string(),
  visits: z.number(),
})

type Result = { label: string; text: string; ok: boolean }

export const CrossDomainPage = () => {
  const agent = useAgent<CrossDomainState>({
    agent: "cross-domain-agent",
    name: "default",
    host: otherHost,
  })
  const connected = agent.identified
  const visits = agent.state?.visits ?? []
  const [name, setName] = useState("visitor")
  const [busy, setBusy] = useState<string | null>(null)
  const [results, setResults] = useState<Result[]>([])

  const run = async (key: string, label: string, action: () => Promise<string>) => {
    setBusy(key)
    try {
      const text = await action()
      setResults((current) => [{ label, text, ok: true }, ...current].slice(0, 6))
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e)
      setResults((current) => [{ label, text, ok: false }, ...current].slice(0, 6))
    } finally {
      setBusy(null)
    }
  }

  const reason = busy !== null ? "Running" : undefined
  const callReason = !connected ? "Waiting for the WebSocket connection" : reason

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Two origins">
        <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-zinc-500">This page</dt>
          <dd>
            <code>{window.location.origin}</code>
          </dd>
          <dt className="text-zinc-500">Agent host</dt>
          <dd>
            <code>{otherOrigin}</code>
          </dd>
        </dl>
        <div className="mb-3">
          <ConnectionBadge connected={connected} />
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-end gap-2">
            <Field label="Name">
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Button
              onClick={() =>
                void run("hello", 'WebSocket: agent.call("hello")', async () =>
                  z.string().parse(await agent.call("hello", [name])),
                )
              }
              disabled={callReason !== undefined || name.trim() === ""}
              disabledReason={callReason ?? "Enter a name"}
            >
              Call over WebSocket
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              tone="secondary"
              onClick={() =>
                void run("http", "HTTP: fetch the agent (cors: true)", async () => {
                  const response = await fetch(agentUrl)
                  const visit = httpVisit.parse(await response.json())
                  return `${response.status}; the agent saw Origin ${visit.origin}`
                })
              }
              disabled={reason !== undefined}
              disabledReason={reason}
            >
              Fetch the agent
            </Button>
            <Button
              tone="secondary"
              onClick={() =>
                void run("asset", "HTTP: fetch a dashboard asset (no CORS headers)", async () => {
                  const response = await fetch(`${otherOrigin}/`)
                  return `${response.status}: the browser let the page read it`
                })
              }
              disabled={reason !== undefined}
              disabledReason={reason}
            >
              Fetch a page without CORS
            </Button>
          </div>
        </div>
        <ul className="mt-3 flex flex-col gap-2">
          {results.map((result, i) => (
            <li
              key={`${i}-${result.label}`}
              className={`rounded border px-2 py-1 text-xs ${result.ok ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-red-50 text-red-800"}`}
            >
              <p className="font-medium">{result.label}</p>
              <p>{result.ok ? result.text : `Blocked or failed: ${result.text}`}</p>
            </li>
          ))}
        </ul>
      </Card>
      <Card title={`What the agent saw (${visits.length})`}>
        <div className="mb-2 flex justify-end">
          <Button
            tone="secondary"
            onClick={() =>
              void run("clear", "Clear", async () => {
                await agent.call("clear", [])
                return "cleared"
              })
            }
            disabled={callReason !== undefined || visits.length === 0}
            disabledReason={callReason ?? "Nothing to clear"}
          >
            Clear
          </Button>
        </div>
        {visits.length === 0 ? (
          <p className="text-sm text-zinc-500">No visits recorded yet.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {visits.map((visit) => (
              <li key={`${visit.at}-${visit.via}`} className="flex gap-2">
                <code className="rounded bg-zinc-100 px-1.5 text-xs">{visit.via}</code>
                <span className="text-zinc-800">Origin {visit.origin}</span>
                <span className="ml-auto text-xs text-zinc-500">{formatTime(visit.at)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-col gap-2 text-xs text-zinc-600">
          <p>
            <code>useAgent({"{ host }"})</code> opens the WebSocket on the other origin. Browsers do
            not apply CORS to WebSockets, so the agent sees the page's <code>Origin</code> header
            and may check it in <code>onBeforeConnect</code>.
          </p>
          <p>
            HTTP is different: the browser reads a cross-origin response only when it carries{" "}
            <code>Access-Control-Allow-Origin</code>. <code>routeAgentRequest</code> adds it with{" "}
            <code>{"{ cors: true }"}</code>; the dashboard's own asset has no such header, so that
            fetch is blocked.
          </p>
          <p>
            In production the agent runs on its own hostname and the page passes it as{" "}
            <code>host</code>. Here both origins are the same <code>wrangler dev</code>, so the
            sample runs only locally.
          </p>
        </div>
      </Card>
    </div>
  )
}
