export type MailEntry = {
  id: string
  direction: "in" | "out"
  from: string
  to: string
  subject: string
  text: string
  at: string
  simulated: boolean
}

export type EmailState = {
  mails: MailEntry[]
}

export const agentAddress = "agent@cfas.example"
export const inboxName = "inbox"
