export type RagDocument = {
  id: string
  title: string
  chunks: number
  addedAt: string
}

export type RagState = {
  documents: RagDocument[]
}

export type SearchHit = {
  docId: string
  title: string
  text: string
  score: number
}

export type Answer = {
  answer: string
  hits: SearchHit[]
}
