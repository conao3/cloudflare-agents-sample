import type { AskResult, BrowserState } from "@cfas/browser/types"
import { useAgent } from "agents/react"
import { useState } from "react"
import * as z from "zod"
import { Button, Card, ConnectionBadge, Field, formatTime, inputClass } from "../ui.tsx"

const askSchema = z.object({ answer: z.string(), toolsUsed: z.array(z.string()) })

type Output =
  | { kind: "markdown"; value: string }
  | { kind: "links"; value: string[] }
  | { kind: "screenshot"; value: string }
  | { kind: "ask"; value: AskResult }
  | { kind: "error"; value: string }

export const BrowserPage = () => {
  const agent = useAgent<BrowserState>({
    agent: "browser-agent",
    name: "default",
    defaultCallTimeout: 120_000,
  })
  const connected = agent.identified
  const log = agent.state?.log ?? []
  const [url, setUrl] = useState("https://developers.cloudflare.com/agents/")
  const [question, setQuestion] = useState("What can I build with this SDK?")
  const [busy, setBusy] = useState<string | null>(null)
  const [output, setOutput] = useState<Output | null>(null)

  const run = async (
    kind: Exclude<Output["kind"], "error">,
    args: unknown[],
    wrap: (value: unknown) => Output,
  ) => {
    setBusy(kind)
    setOutput(null)
    try {
      setOutput(wrap(await agent.call(kind, args)))
    } catch (e) {
      setOutput({ kind: "error", value: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(null)
    }
  }

  const reason = !connected
    ? "Waiting for the WebSocket connection"
    : busy !== null
      ? `Running ${busy}`
      : !/^https?:\/\//.test(url)
        ? "Enter an http(s) URL"
        : undefined

  return (
    <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
      <div className="flex flex-col gap-4">
        <Card title="Page">
          <div className="mb-3">
            <ConnectionBadge connected={connected} />
          </div>
          <Field label="URL">
            <input className={inputClass} value={url} onChange={(e) => setUrl(e.target.value)} />
          </Field>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              onClick={() =>
                void run("markdown", [url], (v) => ({
                  kind: "markdown",
                  value: z.string().parse(v),
                }))
              }
              disabled={reason !== undefined}
              disabledReason={reason}
            >
              Markdown
            </Button>
            <Button
              onClick={() =>
                void run("links", [url], (v) => ({
                  kind: "links",
                  value: z.array(z.string()).parse(v),
                }))
              }
              disabled={reason !== undefined}
              disabledReason={reason}
            >
              Links
            </Button>
            <Button
              onClick={() =>
                void run("screenshot", [url], (v) => ({
                  kind: "screenshot",
                  value: z.string().parse(v),
                }))
              }
              disabled={reason !== undefined}
              disabledReason={reason}
            >
              Screenshot
            </Button>
          </div>
          <div className="mt-3 flex items-end gap-2">
            <Field label="Question for the model (it reads the page with browser tools)">
              <input
                className={`${inputClass} w-96 max-w-full`}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
            </Field>
            <Button
              onClick={() =>
                void run("ask", [url, question], (v) => ({
                  kind: "ask",
                  value: askSchema.parse(v),
                }))
              }
              disabled={reason !== undefined || question.trim() === ""}
              disabledReason={reason ?? "Enter a question"}
            >
              Ask
            </Button>
          </div>
          {busy !== null && (
            <p className="mt-3 text-sm text-zinc-500">Running {busy} in Browser Run…</p>
          )}
        </Card>
        {output !== null && (
          <Card title="Result">
            {output.kind === "error" && <p className="text-sm text-red-700">{output.value}</p>}
            {output.kind === "markdown" && (
              <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap text-xs text-zinc-700">
                {output.value}
              </pre>
            )}
            {output.kind === "links" && (
              <ul className="max-h-[32rem] overflow-auto text-xs">
                {output.value.map((link) => (
                  <li key={link} className="truncate text-zinc-700">
                    {link}
                  </li>
                ))}
              </ul>
            )}
            {output.kind === "screenshot" && (
              <img src={output.value} alt={`Screenshot of ${url}`} className="rounded border" />
            )}
            {output.kind === "ask" && (
              <>
                <p className="whitespace-pre-wrap text-sm text-zinc-800">{output.value.answer}</p>
                <p className="mt-2 text-xs text-zinc-500">
                  Tools used: {output.value.toolsUsed.join(", ") || "none"}
                </p>
              </>
            )}
          </Card>
        )}
      </div>
      <Card title="Activity (agent state)">
        {log.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing yet.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-xs">
            {log.map((entry) => (
              <li key={`${entry.at}-${entry.action}`} className="flex gap-2">
                <span className="text-zinc-500">{formatTime(entry.at)}</span>
                <code>{entry.action}</code>
                <span className={entry.ok ? "text-green-700" : "text-red-700"}>
                  {entry.ok ? `${entry.ms} ms` : "failed"}
                </span>
                <span className="truncate text-zinc-500">{entry.url}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-zinc-500">
          The free plan allows 10 browser minutes per day and a few quick actions per minute. A 429
          error is the per-minute limit: wait a minute and retry.
        </p>
      </Card>
    </div>
  )
}
