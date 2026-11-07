export type GuestbookEntry = {
  id: number
  author: string
  message: string
  createdAt: string
}

export type KvEntry = {
  key: string
  value: string | null
  expiresAt: number | null
}

export type StorageState = {
  visits: number
}
