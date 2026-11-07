import type { GuestbookEntry, KvEntry, StorageState } from "@cfas/storage/types"
import { useAgent } from "agents/react"
import { useCallback, useEffect, useState } from "react"
import { Button, Card, ConnectionBadge, Field, formatTime, inputClass } from "../ui.tsx"

export const StoragePage = () => {
  const agent = useAgent<StorageState>({ agent: "storage-agent", name: "default" })
  const connected = agent.identified
  const [entries, setEntries] = useState<GuestbookEntry[]>([])
  const [notes, setNotes] = useState<KvEntry[]>([])
  const [author, setAuthor] = useState("visitor")
  const [message, setMessage] = useState("Hello from the dashboard")
  const [key, setKey] = useState("greeting")
  const [value, setValue] = useState("hi")
  const [ttl, setTtl] = useState("120")
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [g, n] = await Promise.all([
      agent.call<GuestbookEntry[]>("guestbook", []),
      agent.call<KvEntry[]>("notes", []),
    ])
    setEntries(g)
    setNotes(n)
  }, [agent])

  useEffect(() => {
    if (connected) void load()
  }, [connected, load])

  const act = async (label: string, run: () => Promise<unknown>) => {
    setBusy(label)
    setError(null)
    try {
      await run()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  const base = !connected
    ? "Waiting for the WebSocket connection"
    : busy !== null
      ? "Saving"
      : undefined

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card title="Agent SQLite + state (per agent)">
        <div className="mb-3">
          <ConnectionBadge connected={connected} />
        </div>
        <p className="mb-3 text-4xl font-semibold tabular-nums">{agent.state?.visits ?? "–"}</p>
        <Button
          onClick={() => void act("visit", () => agent.call("visit", []))}
          disabled={base !== undefined}
          disabledReason={base}
        >
          Count a visit
        </Button>
        <p className="mt-3 text-xs text-zinc-500">
          State lives in this agent's own Durable Object. Another agent name would start from zero.
        </p>
      </Card>
      <Card title="D1 (one database shared by every agent)">
        <div className="mb-2 flex flex-col gap-2">
          <Field label="Name">
            <input
              className={inputClass}
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
            />
          </Field>
          <Field label="Message">
            <input
              className={inputClass}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </Field>
        </div>
        <Button
          onClick={() =>
            void act("sign", () => agent.call("sign", [author.trim(), message.trim()]))
          }
          disabled={base !== undefined || author.trim() === "" || message.trim() === ""}
          disabledReason={base ?? "Enter a name and message"}
        >
          Sign the guestbook
        </Button>
        <ul className="mt-3 flex flex-col gap-1 text-sm">
          {entries.length === 0 && <li className="text-zinc-500">No entries yet.</li>}
          {entries.map((e) => (
            <li key={e.id}>
              <span className="font-medium">{e.author}</span>{" "}
              <span className="text-zinc-700">{e.message}</span>{" "}
              <span className="text-xs text-zinc-500">{formatTime(e.createdAt)}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="KV (key-value with expiry)">
        <div className="mb-2 grid grid-cols-2 gap-2">
          <Field label="Key">
            <input className={inputClass} value={key} onChange={(e) => setKey(e.target.value)} />
          </Field>
          <Field label="TTL seconds (min 60)">
            <input className={inputClass} value={ttl} onChange={(e) => setTtl(e.target.value)} />
          </Field>
        </div>
        <Field label="Value">
          <input className={inputClass} value={value} onChange={(e) => setValue(e.target.value)} />
        </Field>
        <div className="mt-2">
          <Button
            onClick={() =>
              void act("put", () => agent.call("putNote", [key.trim(), value, Number(ttl)]))
            }
            disabled={base !== undefined || key.trim() === "" || !(Number(ttl) >= 60)}
            disabledReason={
              base ?? (key.trim() === "" ? "Enter a key" : "TTL must be at least 60 seconds")
            }
          >
            Put
          </Button>
        </div>
        <ul className="mt-3 flex flex-col gap-1 text-sm">
          {notes.length === 0 && <li className="text-zinc-500">No keys yet.</li>}
          {notes.map((n) => (
            <li key={n.key}>
              <code>{n.key}</code> = <span className="text-zinc-700">{n.value ?? "(expired)"}</span>{" "}
              {n.expiresAt !== null && (
                <span className="text-xs text-zinc-500">
                  until {formatTime(new Date(n.expiresAt).toISOString())}
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-zinc-500">
          KV is eventually consistent: a new key can take a moment to show up in list.
        </p>
      </Card>
      {error !== null && <p className="text-sm text-red-700 md:col-span-3">{error}</p>}
    </div>
  )
}
