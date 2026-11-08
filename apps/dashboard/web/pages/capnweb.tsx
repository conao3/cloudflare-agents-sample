import { transports, type Transport } from "@cfas/capnweb/types"
import { useAgent } from "agents/react"
import { useRef, useState } from "react"
import * as z from "zod"
import { Button, Card, ConnectionBadge, Field, formatTime, inputClass } from "../ui.tsx"

const transportSchema = z.enum(transports)

const frameSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("joined"),
    member: z.object({ id: z.string(), transport: transportSchema }),
    members: z.number(),
  }),
  z.object({ type: z.literal("left"), id: z.string(), members: z.number() }),
  z.object({ type: z.literal("said"), from: transportSchema, text: z.string(), at: z.string() }),
  z.object({ type: z.literal("tally"), name: z.string(), value: z.number() }),
])

const pingSchema = z.object({
  at: z.string(),
  members: z.array(z.object({ id: z.string(), transport: transportSchema })),
})

type Tally = { increment: (by: number) => Promise<unknown> }

const tallySchema = z.custom<Tally>(
  (value) => value !== null && (typeof value === "object" || typeof value === "function"),
  "The result is not a stub",
)

type Line = { id: number; text: string; tone: "event" | "result" | "error" }

const describe = (frame: z.infer<typeof frameSchema>): string => {
  switch (frame.type) {
    case "joined":
      return `joined: ${frame.member.transport} member (${frame.members} connected)`
    case "left":
      return `left (${frame.members} connected)`
    case "said":
      return `${frame.from} said "${frame.text}" at ${formatTime(frame.at)}`
    default:
      return `tally "${frame.name}" is now ${frame.value}`
  }
}

const toneClass: Record<Line["tone"], string> = {
  event: "text-zinc-600",
  result: "text-green-800",
  error: "text-red-700",
}

const RoomPane = ({ transport, explain }: { transport: Transport; explain: string }) => {
  const [lines, setLines] = useState<Line[]>([])
  const [text, setText] = useState("hello")
  const [tallyName, setTallyName] = useState("clicks")
  const [handle, setHandle] = useState<Tally | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const nextId = useRef(0)

  const log = (line: string, tone: Line["tone"]) =>
    setLines((current) => [{ id: nextId.current++, text: line, tone }, ...current].slice(0, 30))

  const agent = useAgent({
    agent: "capnweb-room",
    name: "default",
    transport,
    onMessage: (event: MessageEvent) => {
      const frame = frameSchema.safeParse(JSON.parse(String(event.data)))
      if (frame.success) log(describe(frame.data), "event")
    },
  })
  const connected = agent.identified

  const run = async (key: string, label: string, action: () => Promise<string>) => {
    setBusy(key)
    try {
      log(`${label} → ${await action()}`, "result")
    } catch (e) {
      log(`${label} failed: ${e instanceof Error ? e.message : String(e)}`, "error")
    } finally {
      setBusy(null)
    }
  }

  const reason = !connected ? "Waiting for the connection" : busy !== null ? "Running" : undefined

  return (
    <Card title={`transport: "${transport}"`}>
      <div className="mb-2">
        <ConnectionBadge connected={connected} />
      </div>
      <p className="mb-3 text-xs text-zinc-600">{explain}</p>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <Button
            tone="secondary"
            onClick={() =>
              void run("ping", 'agent.call("ping")', async () => {
                const ping = pingSchema.parse(await agent.call("ping"))
                return `${ping.members.map((m) => m.transport).join(", ")} connected, server time ${formatTime(ping.at)}`
              })
            }
            disabled={reason !== undefined}
            disabledReason={reason}
          >
            Ping
          </Button>
          <Field label="Text">
            <input className={inputClass} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <Button
            onClick={() =>
              void run(
                "say",
                `agent.call("say", ["${text}"])`,
                async () =>
                  `broadcast to ${z.number().parse(await agent.call("say", [transport, text]))}`,
              )
            }
            disabled={reason !== undefined || text.trim() === ""}
            disabledReason={reason ?? "Enter a text"}
          >
            Say
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Tally name">
            <input
              className={inputClass}
              value={tallyName}
              onChange={(e) => {
                setTallyName(e.target.value)
                setHandle(null)
              }}
            />
          </Field>
          <Button
            tone="secondary"
            onClick={() =>
              void run("tally", `agent.call("tally", ["${tallyName}"])`, async () => {
                setHandle(null)
                const result = tallySchema.parse(await agent.call("tally", [tallyName]))
                setHandle(() => result)
                return "a live TallyHandle stub"
              })
            }
            disabled={reason !== undefined}
            disabledReason={reason}
          >
            Get handle
          </Button>
          <Button
            onClick={() => {
              if (handle === null) return
              void run(
                "increment",
                "handle.increment(1)",
                async () => `${z.number().parse(await handle.increment(1))}`,
              )
            }}
            disabled={reason !== undefined || handle === null}
            disabledReason={reason ?? "Get a handle first"}
          >
            handle.increment(1)
          </Button>
        </div>
        <ul className="flex max-h-64 min-h-24 flex-col gap-1 overflow-y-auto rounded bg-zinc-50 p-2 font-mono text-xs">
          {lines.length === 0 && (
            <li className="text-zinc-400">Calls and room frames show here.</li>
          )}
          {lines.map((line) => (
            <li key={line.id} className={toneClass[line.tone]}>
              {line.text}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}

export const CapnwebPage = () => (
  <div className="flex flex-col gap-4">
    <div className="grid gap-4 md:grid-cols-2">
      <RoomPane
        transport="cf-websocket"
        explain="The default. Calls are JSON rpc frames on a hibernating WebSocket, so results must be JSON: Get handle fails because an RpcTarget cannot go into a frame."
      />
      <RoomPane
        transport="capnweb"
        explain="Experimental. One Cap'n Web session: stub methods are invoked natively, and Get handle returns a live stub whose increment runs on the Durable Object."
      />
    </div>
    <Card title="How it fits">
      <p className="text-sm text-zinc-700">
        Both panes are <code>useAgent</code> connections to the same <code>CapnwebRoom</code>, a
        plain Durable Object with the <code>WebSockets</code> capability from{" "}
        <code>agents/websockets</code> and an <code>RpcTarget</code> as its callables. Say
        broadcasts a frame that reaches both panes. A capnweb connection keeps the object in memory
        while it is open, so it does not hibernate.
      </p>
    </Card>
  </div>
)
