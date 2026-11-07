import { Agent, callable, routeAgentRequest } from "agents"
import { generateText } from "ai"
import { createWorkersAI } from "workers-ai-provider"
import type { Answer, RagDocument, RagState, SearchHit } from "./types.ts"

const embeddingModel = "@cf/baai/bge-m3"
const chatModel = "@cf/zai-org/glm-4.7-flash"
const chunkSize = 600

const str = (value: unknown): string => (typeof value === "string" ? value : "")

const chunk = (text: string): string[] =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .reduce<string[]>((chunks, paragraph) => {
      const last = chunks.at(-1)
      if (last !== undefined && last.length + paragraph.length < chunkSize) {
        return [...chunks.slice(0, -1), `${last}\n\n${paragraph}`]
      }
      return [...chunks, paragraph]
    }, [])

export class RagAgent extends Agent<Env, RagState> {
  override initialState: RagState = { documents: [] }

  @callable()
  async addDocument(title: string, text: string): Promise<RagDocument> {
    const id = crypto.randomUUID()
    const chunks = chunk(text)
    const vectors = await this.embed(chunks)
    await this.env.VECTORIZE.upsert(
      chunks.map((part, i) => ({
        id: `${id}:${i}`,
        values: vectors[i] ?? [],
        namespace: this.name,
        metadata: { docId: id, title, text: part },
      })),
    )
    const doc: RagDocument = { id, title, chunks: chunks.length, addedAt: new Date().toISOString() }
    this.setState({ documents: [doc, ...this.state.documents] })
    return doc
  }

  @callable()
  async removeDocument(id: string) {
    const doc = this.state.documents.find((d) => d.id === id)
    if (doc === undefined) return
    await this.env.VECTORIZE.deleteByIds(Array.from({ length: doc.chunks }, (_, i) => `${id}:${i}`))
    this.setState({ documents: this.state.documents.filter((d) => d.id !== id) })
  }

  @callable()
  async search(query: string, topK = 4): Promise<SearchHit[]> {
    const [vector] = await this.embed([query])
    const result = await this.env.VECTORIZE.query(vector ?? [], {
      topK,
      namespace: this.name,
      returnMetadata: "all",
    })
    return result.matches.map((match) => ({
      docId: str(match.metadata?.docId),
      title: str(match.metadata?.title),
      text: str(match.metadata?.text),
      score: match.score,
    }))
  }

  @callable()
  async ask(question: string): Promise<Answer> {
    const hits = await this.search(question)
    const context = hits.map((hit, i) => `[${i + 1}] ${hit.title}\n${hit.text}`).join("\n\n")
    const { text } = await generateText({
      model: createWorkersAI({ binding: this.env.AI })(chatModel),
      instructions:
        "Answer using only the numbered context. Cite sources like [1]. If the context does not contain the answer, say so.",
      prompt: `Context:\n${context}\n\nQuestion: ${question}`,
    })
    return { answer: text, hits }
  }

  private async embed(texts: string[]): Promise<number[][]> {
    const result = await this.env.AI.run(embeddingModel, { text: texts })
    if (!("data" in result) || result.data === undefined) {
      throw new Error("The embedding model returned no vectors")
    }
    return result.data
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (await routeAgentRequest(request, env)) ?? new Response("Not found", { status: 404 })
  },
} satisfies ExportedHandler<Env>
