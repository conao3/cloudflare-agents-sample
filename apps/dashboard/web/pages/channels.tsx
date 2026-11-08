import { channelsModel } from "@cfas/channels/types"
import type { ToolPart, TranscriptMessage } from "agents/experimental/channels"
import { WebChannelClient } from "agents/experimental/channels/web/client"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { InlineMarkdown } from "../markdown.tsx"
import { Button, Card, ConnectionBadge, Field, inputClass } from "../ui.tsx"

const nameKey = "cfas-channels-name"
const sender = /^([^:\n]{1,40}): ([\s\S]*)$/

const channelUrl = (room: string, name: string) => {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
  const as = encodeURIComponent(name)
  return `${protocol}//${window.location.host}/channels/${encodeURIComponent(room)}?as=${as}`
}

const textOf = (message: TranscriptMessage) =>
  message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("")

const isPendingTime = (part: TranscriptMessage["parts"][number]): part is ToolPart =>
  part.type === "tool" && part.toolName === "getLocalTime" && part.state === "input-available"

const Room = ({ client, name, room }: { client: WebChannelClient; name: string; room: string }) => {
  const { connected, you, messages, turns } = useSyncExternalStore(
    (listener) => client.subscribe(listener),
    () => client.state,
  )
  const [input, setInput] = useState("")
  const [error, setError] = useState<string | null>(null)
  const answered = useRef(new Set<string>())
  const endRef = useRef<HTMLDivElement>(null)
  const running = turns.find((turn) => turn.status === "running")
  const queued = turns.filter((turn) => turn.status === "queued").length

  const turnOf = (message: TranscriptMessage) =>
    turns.find((turn) => turn.status === "settled" && turn.messageIds.includes(message.id))

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" })
  }, [messages])

  useEffect(() => {
    for (const message of messages) {
      for (const part of message.parts) {
        if (!isPendingTime(part) || part.owner !== you?.id) continue
        const turnId = turnOf(message)?.turnId
        if (turnId === undefined || answered.current.has(part.toolCallId)) continue
        answered.current.add(part.toolCallId)
        void client
          .send({
            type: "tool-result",
            eventId: `result:${part.toolCallId}`,
            turnId,
            toolCallId: part.toolCallId,
            result: {
              ok: true,
              output: {
                localTime: new Date().toLocaleString(),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              },
            },
          })
          .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      }
    }
  })

  const send = () => {
    const text = input.trim()
    if (text === "") return
    setInput("")
    setError(null)
    const id = crypto.randomUUID()
    client
      .send({
        type: "message",
        eventId: id,
        message: { id, role: "user", parts: [{ type: "text", text: `${name}: ${text}` }] },
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }

  const sendReason = !connected
    ? "Waiting for the WebSocket connection"
    : input.trim() === ""
      ? "Type a message"
      : undefined

  return (
    <Card title={`Room "${room}"`}>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
        <ConnectionBadge connected={connected} />
        {you !== undefined && (
          <span>
            You are <code>{you.id}</code>
          </span>
        )}
        {running !== undefined && <span>The agent is answering…</span>}
        {queued > 0 && <span>{queued} queued</span>}
      </div>
      <div className="mb-3 flex max-h-[28rem] min-h-48 flex-col gap-3 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-sm text-zinc-500">
            No messages yet. Open this page in a second tab, join the same room under another name,
            and write from both.
          </p>
        )}
        {messages.map((message) => {
          if (message.role === "user") {
            const match = sender.exec(textOf(message))
            const from = match?.[1] ?? "someone"
            const mine = from === name
            return (
              <div
                key={message.id}
                className={`flex flex-col gap-0.5 ${mine ? "items-end" : "items-start"}`}
              >
                <span className="text-xs text-zinc-500">{mine ? `${from} (you)` : from}</span>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${mine ? "bg-orange-500 text-white" : "bg-blue-100 text-blue-950"}`}
                >
                  {match?.[2] ?? textOf(message)}
                </div>
              </div>
            )
          }
          return (
            <div key={message.id} className="flex flex-col items-start gap-1.5">
              <span className="text-xs text-zinc-500">agent</span>
              {message.parts.map((part, i) => {
                if (part.type === "text" && part.text !== "") {
                  return (
                    <div
                      key={i}
                      className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-900"
                    >
                      <InlineMarkdown text={part.text} />
                    </div>
                  )
                }
                if (part.type === "tool") {
                  return (
                    <div
                      key={part.toolCallId}
                      className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs"
                    >
                      <code className="font-semibold text-zinc-800">{part.toolName}</code>{" "}
                      <span className="text-zinc-500">{part.state}</span>
                      {part.owner !== undefined && (
                        <span className="text-zinc-500">
                          {" "}
                          · runs in {part.owner === you?.id ? "your" : `${part.owner}'s`} browser
                        </span>
                      )}
                      {part.output !== undefined && (
                        <pre className="mt-1 whitespace-pre-wrap text-green-800">
                          {JSON.stringify(part.output)}
                        </pre>
                      )}
                    </div>
                  )
                }
                return null
              })}
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
      {error !== null && <p className="mb-2 text-sm text-red-700">{error}</p>}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (sendReason === undefined) send()
        }}
      >
        <input
          className={`${inputClass} flex-1`}
          value={input}
          placeholder={`Message as ${name}`}
          onChange={(e) => setInput(e.target.value)}
        />
        {running !== undefined && (
          <Button
            tone="secondary"
            onClick={() => void client.send({ type: "cancel", turnId: running.turnId })}
          >
            Stop
          </Button>
        )}
        <Button onClick={send} disabled={sendReason !== undefined} disabledReason={sendReason}>
          Send
        </Button>
      </form>
    </Card>
  )
}

export const ChannelsPage = () => {
  const [name, setName] = useState(
    () => localStorage.getItem(nameKey) ?? `guest-${crypto.randomUUID().slice(0, 4)}`,
  )
  const [room, setRoom] = useState("lobby")
  const [joined, setJoined] = useState<{
    client: WebChannelClient
    name: string
    room: string
  } | null>(null)

  useEffect(() => () => joined?.client.close(), [joined])

  const joinReason =
    name.trim() === "" ? "Enter a name" : room.trim() === "" ? "Enter a room" : undefined

  const join = () => {
    const trimmed = name.trim()
    localStorage.setItem(nameKey, trimmed)
    setJoined({
      client: new WebChannelClient(channelUrl(room.trim(), trimmed)),
      name: trimmed,
      room: room.trim(),
    })
  }

  return (
    <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
      {joined === null ? (
        <Card title="Join a room">
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Your name">
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Room">
              <input
                className={inputClass}
                value={room}
                onChange={(e) => setRoom(e.target.value)}
              />
            </Field>
            <Button onClick={join} disabled={joinReason !== undefined} disabledReason={joinReason}>
              Join
            </Button>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Everyone in a room reaches the same agent object and sees the same transcript.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          <Room client={joined.client} name={joined.name} room={joined.room} />
          <div>
            <Button tone="secondary" onClick={() => setJoined(null)}>
              Leave room
            </Button>
          </div>
        </div>
      )}
      <Card title="What to try">
        <p className="mb-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">
          Experimental: <code>agents/experimental/channels</code> may change between releases.
        </p>
        <ul className="flex list-disc flex-col gap-2 pl-4 text-sm text-zinc-700">
          <li>Open a second tab, join the same room as someone else, and write from both.</li>
          <li>
            Ask the agent the time: <code>getLocalTime</code> has no <code>execute</code>, so only
            the browser of the person who asked answers it.
          </li>
          <li>Send while the agent is answering: the message is queued and runs next.</li>
          <li>Leave and join again, or reload: the transcript is kept by the harness.</li>
        </ul>
        <p className="mt-3 text-xs text-zinc-500">
          Slack and Telegram are Channels of the same kind, fed by webhooks; they need bot accounts,
          so they are not built here. Model: <code>{channelsModel}</code>
        </p>
      </Card>
    </div>
  )
}
