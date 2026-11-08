import {
  handledEvents,
  repoAgentName,
  webhookPath,
  type RepoState,
} from "@cfas/github-webhook/types"
import { useAgent } from "agents/react"
import { useCallback, useEffect, useState } from "react"
import * as z from "zod"
import { Button, Card, ConnectionBadge, Field, formatTime, inputClass } from "../ui.tsx"

const eventSchema = z.object({
  id: z.string(),
  delivery: z.string().nullable(),
  type: z.string(),
  action: z.string().nullable(),
  title: z.string(),
  detail: z.string(),
  url: z.string().nullable(),
  actor: z.string().nullable(),
  receivedAt: z.string(),
})

type RepoEvent = z.infer<typeof eventSchema>

const defaultRepo = "conao3/cloudflare-agents-sample"

const repoPattern = /^[\w.-]+\/[\w.-]+$/

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border border-zinc-200 px-3 py-2">
    <p className="text-xs text-zinc-500">{label}</p>
    <p className="text-lg font-semibold text-zinc-900">{value}</p>
  </div>
)

const Setting = ({ label, value }: { label: string; value: string }) => (
  <div className="grid grid-cols-[10rem_1fr] gap-2 text-sm">
    <span className="text-zinc-500">{label}</span>
    <code className="break-all text-zinc-900">{value}</code>
  </div>
)

const RepoView = ({ repo }: { repo: string }) => {
  const agent = useAgent<RepoState>({ agent: "repo-agent", name: repoAgentName(repo) })
  const connected = agent.identified
  const state = agent.state
  const [events, setEvents] = useState<RepoEvent[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setEvents(z.array(eventSchema).parse(await agent.call("listEvents", [50])))
  }, [agent])

  useEffect(() => {
    if (connected) {
      void load()
    }
  }, [connected, state?.updatedAt, load])

  const clear = async () => {
    setBusy(true)
    setError(null)
    try {
      await agent.call("clearEvents", [])
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const stats = state?.stats ?? null

  return (
    <>
      <Card title={`Repository ${repo}`}>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <ConnectionBadge connected={connected} />
          <span className="text-zinc-500">
            agent <code>repo-agent/{repoAgentName(repo)}</code>
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Stars" value={stats === null ? "–" : String(stats.stars)} />
          <Stat label="Forks" value={stats === null ? "–" : String(stats.forks)} />
          <Stat label="Open issues" value={stats === null ? "–" : String(stats.openIssues)} />
          <Stat label="Stored events" value={String(state?.events ?? 0)} />
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          {state?.lastEvent === null || state?.lastEvent === undefined
            ? "No webhook received yet. Stats come from the repository object in each payload."
            : `Last update: ${state.lastEvent.type} at ${formatTime(state.lastEvent.at)}`}
        </p>
      </Card>
      <Card title={`Events (${events.length})`}>
        <div className="mb-2 flex justify-end">
          <Button
            tone="secondary"
            onClick={() => void clear()}
            disabled={!connected || busy || events.length === 0}
            disabledReason={
              !connected
                ? "Waiting for the WebSocket connection"
                : busy
                  ? "Clearing"
                  : "No events to clear"
            }
          >
            Clear events
          </Button>
        </div>
        {error !== null && <p className="mb-2 text-sm text-red-700">{error}</p>}
        {events.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No events yet. Add the webhook below, or send a signed sample with curl.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {events.map((event) => (
              <li key={event.id} className="rounded-md border border-zinc-200 p-2 text-sm">
                <div className="flex items-center gap-2">
                  <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-700">
                    {event.type}
                  </code>
                  {event.url === null ? (
                    <span className="font-medium text-zinc-900">{event.title}</span>
                  ) : (
                    <a
                      href={event.url}
                      className="font-medium text-zinc-900 hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {event.title}
                    </a>
                  )}
                  <span className="ml-auto text-xs text-zinc-500">
                    {event.actor ?? ""} {formatTime(event.receivedAt)}
                  </span>
                </div>
                {event.detail !== "" && <p className="mt-1 text-zinc-600">{event.detail}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}

export const GithubWebhookPage = () => {
  const [input, setInput] = useState(defaultRepo)
  const [repo, setRepo] = useState(defaultRepo)
  const valid = repoPattern.test(input.trim())
  const payloadUrl = `${window.location.origin}${webhookPath}`

  return (
    <div className="flex flex-col gap-4">
      <Card title="Repository">
        <div className="flex items-end gap-2">
          <Field label="owner/name">
            <input
              className={`${inputClass} w-80`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </Field>
          <Button
            onClick={() => setRepo(input.trim())}
            disabled={!valid || input.trim() === repo}
            disabledReason={valid ? "Already showing this repository" : "Enter owner/name"}
          >
            Show
          </Button>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Each repository has its own <code>RepoAgent</code>, named <code>owner-name</code> in lower
          case. The Worker verifies <code>X-Hub-Signature-256</code>, picks the agent with{" "}
          <code>getAgentByName</code>, and the agent keeps the newest 100 events in{" "}
          <code>this.sql</code>.
        </p>
      </Card>
      <RepoView key={repo} repo={repo} />
      <Card title="GitHub webhook settings">
        <p className="mb-3 text-sm text-zinc-600">
          In{" "}
          <a
            href={`https://github.com/${repo}/settings/hooks/new`}
            className="text-orange-700 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            {repo} → Settings → Webhooks → Add webhook
          </a>
          , enter:
        </p>
        <div className="flex flex-col gap-1.5">
          <Setting label="Payload URL" value={payloadUrl} />
          <Setting label="Content type" value="application/json" />
          <Setting
            label="Secret"
            value="the value of GITHUB_WEBHOOK_SECRET (samples/github-webhook/.dev.vars locally, wrangler secret put when deployed)"
          />
          <Setting label="SSL verification" value="Enable" />
          <Setting label="Events" value={`Let me select: ${handledEvents.join(", ")}`} />
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          GitHub cannot reach localhost, so locally the README sends signed sample payloads with
          curl. A request with a wrong signature gets 401; without the secret set, every request
          gets 500.
        </p>
      </Card>
    </div>
  )
}
