import type { PushState } from "@cfas/push/types"
import { useAgent } from "agents/react"
import { useCallback, useEffect, useState } from "react"
import * as z from "zod"
import { Button, Card, ConnectionBadge, Field, formatTime, inputClass } from "../ui.tsx"

const sendResultSchema = z.object({
  title: z.string(),
  body: z.string(),
  at: z.string(),
  deliveries: z.array(
    z.object({
      service: z.string(),
      status: z.number(),
      ok: z.boolean(),
      error: z.string().nullable(),
    }),
  ),
})

const reminderSchema = z.object({
  id: z.string(),
  scheduleId: z.string(),
  message: z.string(),
  dueAt: z.string(),
  status: z.enum(["pending", "sent", "cancelled"]),
  createdAt: z.string(),
})

type SendResult = z.infer<typeof sendResultSchema>

type Reminder = z.infer<typeof reminderSchema>

const browserIdKey = "cfas-push-browser-id"

const browserId = (): string => {
  const stored = localStorage.getItem(browserIdKey)
  if (stored !== null) return stored
  const id = crypto.randomUUID()
  localStorage.setItem(browserIdKey, id)
  return id
}

const supported =
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window

const base64urlToBytes = (value: string): Uint8Array<ArrayBuffer> => {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/")
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e))

const statusClass: Record<Reminder["status"], string> = {
  pending: "bg-amber-100 text-amber-800",
  sent: "bg-green-100 text-green-800",
  cancelled: "bg-zinc-200 text-zinc-700",
}

const SendResultView = ({ result }: { result: SendResult }) => (
  <div className="mt-3 rounded-md border border-zinc-200 p-3 text-sm">
    <p className="text-zinc-700">
      <span className="font-medium">{result.title}</span>: {result.body}{" "}
      <span className="text-xs text-zinc-500">at {formatTime(result.at)}</span>
    </p>
    {result.deliveries.length === 0 ? (
      <p className="mt-1 text-zinc-500">No subscriptions, so nothing was sent.</p>
    ) : (
      <ul className="mt-1 flex flex-col gap-1">
        {result.deliveries.map((d, i) => (
          <li key={i} className={d.ok ? "text-green-700" : "text-red-700"}>
            {d.service}: HTTP {d.status} {d.ok ? "accepted" : (d.error ?? "failed")}
          </li>
        ))}
      </ul>
    )}
  </div>
)

export const PushPage = () => {
  const [name] = useState(browserId)
  const agent = useAgent<PushState>({ agent: "push-agent", name })
  const connected = agent.identified
  const state = agent.state
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    supported ? Notification.permission : "unsupported",
  )
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [text, setText] = useState("Stand up and stretch")
  const [delay, setDelay] = useState("10")

  useEffect(() => {
    if (!supported) return
    void (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js")
        setRegistration(reg)
        setSubscription(await reg.pushManager.getSubscription())
      } catch (e) {
        setError(`Service worker registration failed: ${message(e)}`)
      }
    })()
  }, [])

  const loadReminders = useCallback(async () => {
    setReminders(z.array(reminderSchema).parse(await agent.call("listReminders", [])))
  }, [agent])

  useEffect(() => {
    if (connected) {
      void loadReminders()
    }
  }, [connected, state?.updatedAt, loadReminders])

  const run = async (key: string, action: () => Promise<string | null>) => {
    setBusy(key)
    setError(null)
    setNotice(null)
    try {
      setNotice(await action())
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(null)
    }
  }

  const enable = () =>
    run("enable", async () => {
      if (registration === null) throw new Error("The service worker is not registered yet")
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result !== "granted") throw new Error(`Notification permission is ${result}`)
      const key = z.string().parse(await agent.call("getVapidPublicKey", []))
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64urlToBytes(key),
      })
      const count = z.number().parse(await agent.call("subscribe", [sub.toJSON()]))
      setSubscription(sub)
      return `Subscribed through ${new URL(sub.endpoint).host}. The agent stores ${count} subscription(s).`
    })

  const disable = () =>
    run("disable", async () => {
      if (subscription === null) return null
      await agent.call("unsubscribe", [subscription.endpoint])
      await subscription.unsubscribe()
      setSubscription(null)
      return "Unsubscribed. The agent deleted this endpoint."
    })

  const sendTest = () =>
    run("test", async () => {
      const result = sendResultSchema.parse(await agent.call("sendTest", []))
      const accepted = result.deliveries.filter((d) => d.ok).length
      return `Sent to ${accepted} of ${result.deliveries.length} subscription(s).`
    })

  const createReminder = () =>
    run("remind", async () => {
      const reminder = reminderSchema.parse(
        await agent.call("createReminder", [text.trim(), Number(delay)]),
      )
      await loadReminders()
      return `Reminder scheduled for ${formatTime(reminder.dueAt)}. You can close this tab.`
    })

  const cancel = (id: string) =>
    run(id, async () => {
      const cancelled = z.boolean().parse(await agent.call("cancelReminder", [id]))
      await loadReminders()
      return cancelled ? "Reminder cancelled." : "The reminder already ran."
    })

  const enableReason = !supported
    ? "This browser has no Push API"
    : !connected
      ? "Waiting for the WebSocket connection"
      : registration === null
        ? "Registering the service worker"
        : permission === "denied"
          ? "Notifications are blocked for this site; allow them in the site settings"
          : busy !== null
            ? "Running"
            : undefined
  const sendReason = !connected
    ? "Waiting for the WebSocket connection"
    : busy !== null
      ? "Running"
      : (state?.subscriptions ?? 0) === 0
        ? "Enable notifications first"
        : undefined
  const remindReason =
    sendReason ??
    (text.trim() === ""
      ? "Enter a message"
      : !(Number(delay) > 0)
        ? "Enter a positive number of seconds"
        : undefined)
  const shownSend = state?.lastSend ?? null

  return (
    <div className="flex flex-col gap-4">
      <Card title="1. Enable notifications">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <ConnectionBadge connected={connected} />
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700">
            permission: {permission}
          </span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700">
            service worker: {registration === null ? "not registered" : "/sw.js"}
          </span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700">
            agent subscriptions: {state?.subscriptions ?? 0}
          </span>
        </div>
        {subscription === null ? (
          <Button
            onClick={() => void enable()}
            disabled={enableReason !== undefined}
            disabledReason={enableReason}
          >
            {busy === "enable" ? "Subscribing…" : "Enable notifications"}
          </Button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-green-700">
              Subscribed through {new URL(subscription.endpoint).host}
            </span>
            <Button
              tone="secondary"
              onClick={() => void disable()}
              disabled={busy !== null}
              disabledReason="Running"
            >
              Unsubscribe
            </Button>
          </div>
        )}
        <p className="mt-3 text-xs text-zinc-500">
          The page registers <code>/sw.js</code>, asks for permission, subscribes with the
          agent&apos;s VAPID public key, and hands the subscription to the agent, which keeps it in{" "}
          <code>this.sql</code> (not in state, so the endpoint is never broadcast). The agent is per
          browser: its name is a random id kept in this browser&apos;s local storage.
        </p>
        {notice !== null && <p className="mt-2 text-sm text-green-700">{notice}</p>}
        {error !== null && <p className="mt-2 text-sm text-red-700">{error}</p>}
      </Card>
      <Card title="2. Send a test notification">
        <Button
          onClick={() => void sendTest()}
          disabled={sendReason !== undefined}
          disabledReason={sendReason}
        >
          {busy === "test" ? "Sending…" : "Send test"}
        </Button>
        {shownSend !== null && <SendResultView result={shownSend} />}
      </Card>
      <Card title="3. Schedule a reminder">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Message">
            <input className={inputClass} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <Field label="Delay (seconds)">
            <input
              className={`${inputClass} w-28`}
              type="number"
              min={1}
              value={delay}
              onChange={(e) => setDelay(e.target.value)}
            />
          </Field>
          <Button
            onClick={() => void createReminder()}
            disabled={remindReason !== undefined}
            disabledReason={remindReason}
          >
            {busy === "remind" ? "Scheduling…" : "Schedule"}
          </Button>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          <code>this.schedule(delaySeconds, &quot;sendReminder&quot;)</code> sets a Durable Object
          alarm, so the push arrives even after this tab is closed.
        </p>
      </Card>
      <Card title={`Reminders (${state?.pendingReminders ?? 0} pending)`}>
        {reminders.length === 0 ? (
          <p className="text-sm text-zinc-500">No reminders yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {reminders.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-2 rounded-md border border-zinc-200 p-2 text-sm"
              >
                <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass[r.status]}`}>
                  {r.status}
                </span>
                <span className="text-zinc-900">{r.message}</span>
                <span className="ml-auto text-xs text-zinc-500">due {formatTime(r.dueAt)}</span>
                {r.status === "pending" && (
                  <Button
                    tone="danger"
                    onClick={() => void cancel(r.id)}
                    disabled={busy !== null}
                    disabledReason="Running"
                  >
                    Cancel
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
