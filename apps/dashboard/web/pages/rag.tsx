import type { Answer, RagState, SearchHit } from "@cfas/rag/types"
import { useAgent } from "agents/react"
import { useState } from "react"
import { Button, Card, ConnectionBadge, Field, formatTime, inputClass } from "../ui.tsx"

const sampleDocs = [
  {
    title: "Agents SDK",
    text: "An agent is a Durable Object with its own SQLite database, state, WebSocket connections, and alarms.\n\nAgents sleep while idle and wake on an HTTP request, a WebSocket message, an email, or a scheduled task. Idle agents that hibernate are not billed for duration.",
  },
  {
    title: "Workflows",
    text: "Workflows run durable multi-step jobs. Each step.do result is persisted and retried on failure.\n\nAn agent starts a workflow with runWorkflow and can pause it with waitForApproval until a human approves or rejects it.",
  },
  {
    title: "Free plan",
    text: "On the Workers Free plan, Workers AI includes 10,000 Neurons per day and Browser Run includes 10 browser minutes per day.\n\nVectorize on the Free plan includes 30 million queried vector dimensions and 5 million stored vector dimensions per month.",
  },
]

export const RagPage = () => {
  const agent = useAgent<RagState>({
    agent: "rag-agent",
    name: "default",
    defaultCallTimeout: 120_000,
  })
  const connected = agent.identified
  const documents = agent.state?.documents ?? []
  const [title, setTitle] = useState("")
  const [text, setText] = useState("")
  const [question, setQuestion] = useState("How much Workers AI can I use for free?")
  const [hits, setHits] = useState<SearchHit[] | null>(null)
  const [answer, setAnswer] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const act = async <T,>(key: string, method: string, args: unknown[]): Promise<T | undefined> => {
    setBusy(key)
    setError(null)
    try {
      return await agent.call<T>(method, args)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return undefined
    } finally {
      setBusy(null)
    }
  }

  const loadSamples = async () => {
    for (const doc of sampleDocs) {
      if (documents.some((d) => d.title === doc.title)) continue
      await act("samples", "addDocument", [doc.title, doc.text])
    }
  }

  const base = !connected
    ? "Waiting for the WebSocket connection"
    : busy !== null
      ? `Running ${busy}`
      : undefined
  const missingSamples = sampleDocs.filter(
    (doc) => !documents.some((d) => d.title === doc.title),
  ).length

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="flex flex-col gap-4">
        <Card title={`Documents (${documents.length})`}>
          <div className="mb-3 flex items-center justify-between">
            <ConnectionBadge connected={connected} />
            <Button
              tone="secondary"
              onClick={() => void loadSamples()}
              disabled={base !== undefined || missingSamples === 0}
              disabledReason={base ?? "The sample documents are already loaded"}
            >
              Load sample documents
            </Button>
          </div>
          <ul className="mb-3 flex flex-col gap-1">
            {documents.length === 0 && <li className="text-sm text-zinc-500">No documents yet.</li>}
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center gap-2 text-sm">
                <span className="text-zinc-900">{doc.title}</span>
                <span className="text-xs text-zinc-500">
                  {doc.chunks} {doc.chunks === 1 ? "chunk" : "chunks"}, {formatTime(doc.addedAt)}
                </span>
                <span className="ml-auto">
                  <Button
                    tone="danger"
                    onClick={() => void act("remove", "removeDocument", [doc.id])}
                    disabled={base !== undefined}
                    disabledReason={base}
                  >
                    Remove
                  </Button>
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2">
            <Field label="Title">
              <input
                className={inputClass}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field label="Text (paragraphs separated by a blank line)">
              <textarea
                className={inputClass}
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </Field>
            <p className="text-xs text-zinc-500">
              New documents take a few seconds to become searchable in Vectorize.
            </p>
            <div>
              <Button
                onClick={() =>
                  void act("add", "addDocument", [title.trim(), text]).then(() => {
                    setTitle("")
                    setText("")
                  })
                }
                disabled={base !== undefined || title.trim() === "" || text.trim() === ""}
                disabledReason={base ?? "Enter a title and text"}
              >
                Add document
              </Button>
            </div>
          </div>
        </Card>
      </div>
      <Card title="Ask">
        <Field label="Question">
          <input
            className={inputClass}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </Field>
        <div className="mt-3 flex gap-2">
          <Button
            tone="secondary"
            onClick={() =>
              void act<SearchHit[]>("search", "search", [question]).then(
                (r) => r !== undefined && (setHits(r), setAnswer(null)),
              )
            }
            disabled={base !== undefined || question.trim() === ""}
            disabledReason={base ?? "Enter a question"}
          >
            Search only
          </Button>
          <Button
            onClick={() =>
              void act<Answer>("ask", "ask", [question]).then(
                (r) => r !== undefined && (setHits(r.hits), setAnswer(r.answer)),
              )
            }
            disabled={base !== undefined || question.trim() === ""}
            disabledReason={base ?? "Enter a question"}
          >
            Ask
          </Button>
        </div>
        {busy !== null && <p className="mt-3 text-sm text-zinc-500">Running {busy}…</p>}
        {error !== null && <p className="mt-3 text-sm text-red-700">{error}</p>}
        {answer !== null && (
          <p className="mt-3 whitespace-pre-wrap rounded bg-orange-50 p-3 text-sm text-zinc-900">
            {answer}
          </p>
        )}
        {hits !== null && (
          <ol className="mt-3 flex flex-col gap-2">
            {hits.length === 0 && <li className="text-sm text-zinc-500">No matches.</li>}
            {hits.map((hit, i) => (
              <li key={`${hit.docId}-${i}`} className="rounded border border-zinc-200 p-2 text-sm">
                <div className="flex gap-2 text-xs text-zinc-500">
                  <span>[{i + 1}]</span>
                  <span className="font-medium text-zinc-800">{hit.title}</span>
                  <span className="ml-auto">score {hit.score.toFixed(3)}</span>
                </div>
                <p className="whitespace-pre-wrap text-zinc-700">{hit.text}</p>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  )
}
