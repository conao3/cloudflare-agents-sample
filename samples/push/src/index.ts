import { Agent, callable, routeAgentRequest } from "agents"
import webpush from "web-push"
import type { Delivery, PushState, PushSubscriptionJson, Reminder, SendResult } from "./types.ts"

type SubscriptionRow = { endpoint: string; p256dh: string; auth: string }

type ReminderRow = {
  id: string
  schedule_id: string
  message: string
  due_at: string
  status: Reminder["status"]
  created_at: string
}

const reminderLimit = 30

const required = (value: string | undefined, name: string): string => {
  if (value === undefined || value === "") throw new Error(`${name} is not set`)
  return value
}

const errorText = (error: unknown): string => {
  if (error instanceof webpush.WebPushError) return `${error.statusCode} ${error.body}`.trim()
  return error instanceof Error ? error.message : String(error)
}

export class PushAgent extends Agent<Env, PushState> {
  override initialState: PushState = {
    subscriptions: 0,
    pendingReminders: 0,
    lastSend: null,
    updatedAt: null,
  }

  override onStart() {
    void this.sql`create table if not exists subscriptions (
      endpoint text primary key,
      p256dh text not null,
      auth text not null,
      created_at text not null
    )`
    void this.sql`create table if not exists reminders (
      id text primary key,
      schedule_id text not null,
      message text not null,
      due_at text not null,
      status text not null,
      created_at text not null
    )`
  }

  @callable()
  getVapidPublicKey(): string {
    return required(this.env.VAPID_PUBLIC_KEY, "VAPID_PUBLIC_KEY")
  }

  @callable()
  subscribe(subscription: PushSubscriptionJson): number {
    const now = new Date().toISOString()
    void this.sql`insert into subscriptions (endpoint, p256dh, auth, created_at)
      values (${subscription.endpoint}, ${subscription.keys.p256dh}, ${subscription.keys.auth}, ${now})
      on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth`
    return this.refresh()
  }

  @callable()
  unsubscribe(endpoint: string): number {
    void this.sql`delete from subscriptions where endpoint = ${endpoint}`
    return this.refresh()
  }

  @callable()
  async sendTest(): Promise<SendResult> {
    return this.pushToAll("Test notification", "Sent from PushAgent with Web Push")
  }

  @callable()
  async createReminder(message: string, delaySeconds: number): Promise<Reminder> {
    const id = crypto.randomUUID()
    const schedule = await this.schedule(delaySeconds, "sendReminder", { id })
    const now = new Date()
    const dueAt = new Date(now.getTime() + delaySeconds * 1000).toISOString()
    void this.sql`insert into reminders (id, schedule_id, message, due_at, status, created_at)
      values (${id}, ${schedule.id}, ${message}, ${dueAt}, 'pending', ${now.toISOString()})`
    this.refresh()
    return {
      id,
      scheduleId: schedule.id,
      message,
      dueAt,
      status: "pending",
      createdAt: now.toISOString(),
    }
  }

  @callable()
  async cancelReminder(id: string): Promise<boolean> {
    const row = this.sql<ReminderRow>`select * from reminders where id = ${id}`[0]
    if (row === undefined || row.status !== "pending") return false
    await this.cancelSchedule(row.schedule_id)
    void this.sql`update reminders set status = 'cancelled' where id = ${id}`
    this.refresh()
    return true
  }

  @callable()
  listReminders(): Reminder[] {
    return this.sql<ReminderRow>`select * from reminders order by created_at desc limit ${reminderLimit}`.map(
      (row) => ({
        id: row.id,
        scheduleId: row.schedule_id,
        message: row.message,
        dueAt: row.due_at,
        status: row.status,
        createdAt: row.created_at,
      }),
    )
  }

  async sendReminder({ id }: { id: string }) {
    const row = this.sql<ReminderRow>`select * from reminders where id = ${id}`[0]
    if (row === undefined || row.status !== "pending") return
    void this.sql`update reminders set status = 'sent' where id = ${id}`
    await this.pushToAll("Reminder", row.message)
  }

  private async pushToAll(title: string, body: string): Promise<SendResult> {
    const vapid = {
      subject: required(this.env.VAPID_SUBJECT, "VAPID_SUBJECT"),
      publicKey: required(this.env.VAPID_PUBLIC_KEY, "VAPID_PUBLIC_KEY"),
      privateKey: required(this.env.VAPID_PRIVATE_KEY, "VAPID_PRIVATE_KEY"),
    }
    const subscriptions = this.sql<SubscriptionRow>`select endpoint, p256dh, auth from subscriptions`
    const payload = JSON.stringify({ title, body, tag: crypto.randomUUID() })
    const deliveries = await Promise.all(
      subscriptions.map(async (sub): Promise<Delivery> => {
        const service = new URL(sub.endpoint).host
        try {
          const response = await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            { vapidDetails: vapid, TTL: 60 },
          )
          return { service, status: response.statusCode, ok: true, error: null }
        } catch (error) {
          const status = error instanceof webpush.WebPushError ? error.statusCode : 0
          if (status === 404 || status === 410) {
            void this.sql`delete from subscriptions where endpoint = ${sub.endpoint}`
          }
          return { service, status, ok: false, error: errorText(error) }
        }
      }),
    )
    const result: SendResult = { title, body, at: new Date().toISOString(), deliveries }
    this.refresh(result)
    return result
  }

  private refresh(lastSend: SendResult | null = this.state.lastSend): number {
    const subscriptions =
      this.sql<{ n: number }>`select count(*) as n from subscriptions`[0]?.n ?? 0
    const pendingReminders =
      this.sql<{ n: number }>`select count(*) as n from reminders where status = 'pending'`[0]?.n ??
      0
    this.setState({
      subscriptions,
      pendingReminders,
      lastSend,
      updatedAt: new Date().toISOString(),
    })
    return subscriptions
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (await routeAgentRequest(request, env)) ?? new Response("Not found", { status: 404 })
  },
} satisfies ExportedHandler<Env>
