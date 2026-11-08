export type PushSubscriptionJson = {
  endpoint: string
  expirationTime: number | null
  keys: { p256dh: string; auth: string }
}

export type Delivery = {
  service: string
  status: number
  ok: boolean
  error: string | null
}

export type SendResult = {
  title: string
  body: string
  at: string
  deliveries: Delivery[]
}

export type ReminderStatus = "pending" | "sent" | "cancelled"

export type Reminder = {
  id: string
  scheduleId: string
  message: string
  dueAt: string
  status: ReminderStatus
  createdAt: string
}

export type PushState = {
  subscriptions: number
  pendingReminders: number
  lastSend: SendResult | null
  updatedAt: string | null
}
