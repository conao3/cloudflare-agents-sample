import { gatewayId, type GatewayLog, type GatewayState } from "@cfas/ai-gateway/types"
import { useAgent } from "agents/react"
import { useState } from "react"
import { Button, Card, ConnectionBadge, Field, formatTime, inputClass } from "../ui.tsx"

export const AiGatewayPage = () => {
  const agent = useAgent<GatewayState>({
    agent: "ai-gateway-agent",
    name: "default",
    defaultCallTimeout: 120_000,
  })
  const connected = agent.identified
  const calls = agent.state?.calls ?? []
  const [question, setQuestion] = useState("What is a Durable Object?")
  const [cacheTtl, setCacheTtl] = useState("300")
  const [skipCache, setSkipCache] = useState(false)
  const [logs, setLogs] = useState<Record<string, GatewayLog | string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ask = async () => {
    setBusy(true)
    setError(null)
    try {
      await agent.call("ask", [question.trim(), Number(cacheTtl), skipCache])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const loadLog = async (logId: string) => {
    try {
      const log = await agent.call<GatewayLog>("log", [logId])
      setLogs((l) => ({ ...l, [logId]: log }))
    } catch (e) {
      setLogs((l) => ({ ...l, [logId]: e instanceof Error ? e.message : String(e) }))
    }
  }

  const reason = !connected
    ? "Waiting for the WebSocket connection"
    : busy
      ? "Asking"
      : question.trim() === ""
        ? "Enter a question"
        : !(Number(cacheTtl) >= 0)
          ? "Cache TTL must be a number"
          : undefined

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
      <Card title={`Ask through gateway "${gatewayId}"`}>
        <div className="mb-3">
          <ConnectionBadge connected={connected} />
        </div>
        <div className="flex flex-col gap-2">
          <Field label="Question">
            <input
              className={inputClass}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </Field>
          <Field label="Cache TTL (seconds)">
            <input
              className={inputClass}
              value={cacheTtl}
              onChange={(e) => setCacheTtl(e.target.value)}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={skipCache}
              onChange={(e) => setSkipCache(e.target.checked)}
            />
            Skip the cache
          </label>
        </div>
        <div className="mt-3">
          <Button
            onClick={() => void ask()}
            disabled={reason !== undefined}
            disabledReason={reason}
          >
            Ask
          </Button>
        </div>
        {error !== null && <p className="mt-2 text-sm text-red-700">{error}</p>}
        <p className="mt-3 text-xs text-zinc-500">
          Ask the same question again a few seconds after the first answer: it comes from the
          gateway cache. Open the log to see the cache hit, latency, and tokens the gateway
          recorded.
        </p>
      </Card>
      <Card title={`Calls (${calls.length})`}>
        <div className="mb-2 flex justify-end">
          <Button
            tone="secondary"
            onClick={() => void agent.call("clear", [])}
            disabled={calls.length === 0}
            disabledReason="No calls yet"
          >
            Clear
          </Button>
        </div>
        {calls.length === 0 ? (
          <p className="text-sm text-zinc-500">No calls yet.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {calls.map((c) => {
              const log = c.logId === null ? undefined : logs[c.logId]
              return (
                <li key={c.id} className="rounded border border-zinc-200 p-2">
                  <div className="flex gap-2 text-xs text-zinc-500">
                    <span>{formatTime(c.at)}</span>
                    <span>{c.ms} ms</span>
                    <span>{c.skipCache ? "cache skipped" : `ttl ${c.cacheTtl}s`}</span>
                  </div>
                  <p className="font-medium text-zinc-900">{c.question}</p>
                  <p className="text-zinc-700">{c.answer}</p>
                  {c.logId !== null && log === undefined && (
                    <button
                      type="button"
                      className="mt-1 text-xs text-orange-700 hover:underline"
                      onClick={() => void loadLog(c.logId ?? "")}
                    >
                      Show gateway log
                    </button>
                  )}
                  {typeof log === "string" && <p className="mt-1 text-xs text-red-700">{log}</p>}
                  {log !== undefined && typeof log !== "string" && (
                    <p className="mt-1 text-xs text-zinc-600">
                      {log.cached ? "cache hit" : "cache miss"}, {log.durationMs} ms in gateway,
                      status {log.statusCode}, tokens {log.tokensIn ?? "?"} in /{" "}
                      {log.tokensOut ?? "?"} out, {log.provider} {log.model}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
