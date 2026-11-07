export type Thread = {
  id: string
  from: string
  subject: string
  text: string
  reply: string
  sources: string[]
  receivedAt: string
  simulated: boolean
}

export type InboxState = {
  threads: Thread[]
}

export const inboxAddress = "support@cfas.example"
export const inboxName = "support"
export const knowledgeNamespace = "default"
