import type { TaskSummary, WorkspaceFile } from "@cfas/think/types"
import { useAgent } from "agents/react"
import { useCallback, useEffect, useState } from "react"
import { ChatView } from "../chat-view.tsx"
import { Button, Card, Field, formatTime, inputClass } from "../ui.tsx"

const statusClass: Record<TaskSummary["status"], string> = {
  pending: "bg-zinc-100 text-zinc-700",
  running: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  aborted: "bg-zinc-200 text-zinc-700",
  skipped: "bg-zinc-200 text-zinc-700",
  error: "bg-red-100 text-red-800",
}

const Side = ({ refreshKey }: { refreshKey: number }) => {
  const agent = useAgent({ agent: "think-agent", name: "default", defaultCallTimeout: 120_000 })
  const [tasks, setTasks] = useState<TaskSummary[]>([])
  const [files, setFiles] = useState<WorkspaceFile[]>([])
  const [open, setOpen] = useState<{ path: string; text: string } | null>(null)
  const [prompt, setPrompt] = useState(
    "Write a haiku about Durable Objects and save it to /notes/haiku.md",
  )
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [t, f] = await Promise.all([
      agent.call<TaskSummary[]>("taskList", []),
      agent.call<WorkspaceFile[]>("files", []),
    ])
    setTasks(t)
    setFiles(f)
  }, [agent])

  useEffect(() => {
    if (agent.identified) void load()
  }, [agent.identified, refreshKey, load])

  const running = tasks.some((t) => t.status === "pending" || t.status === "running")
  useEffect(() => {
    if (!running) return undefined
    const timer = setInterval(() => void load(), 2000)
    return () => clearInterval(timer)
  }, [running, load])

  const submit = async () => {
    setBusy(true)
    try {
      await agent.call("submitTask", [prompt])
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card title="Background task (submitMessages)">
        <Field label="Prompt">
          <textarea
            className={inputClass}
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </Field>
        <div className="mt-2">
          <Button
            onClick={() => void submit()}
            disabled={!agent.identified || busy || prompt.trim() === ""}
            disabledReason={
              !agent.identified
                ? "Waiting for the WebSocket connection"
                : busy
                  ? "Submitting"
                  : "Enter a prompt"
            }
          >
            Submit
          </Button>
        </div>
        <ul className="mt-3 flex flex-col gap-1 text-sm">
          {tasks.length === 0 && <li className="text-zinc-500">No tasks yet.</li>}
          {tasks.map((t) => (
            <li key={t.submissionId} className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass[t.status]}`}>
                {t.status}
              </span>
              <span className="truncate text-zinc-800" title={t.error ?? t.prompt}>
                {t.prompt}
              </span>
              <span className="ml-auto text-xs text-zinc-500">
                {formatTime(new Date(t.createdAt).toISOString())}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-zinc-500">
          A submitted task runs as its own turn even if you close the page. Its answer appears in
          the conversation.
        </p>
      </Card>
      <Card title={`Workspace files (${files.length})`}>
        {files.length === 0 ? (
          <p className="text-sm text-zinc-500">Ask the agent to save something to a file.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {files.map((f) => (
              <li key={f.path}>
                <button
                  type="button"
                  className="w-full rounded px-1 text-left hover:bg-zinc-50"
                  onClick={() =>
                    void agent
                      .call<string>("readFile", [f.path])
                      .then((text) => setOpen({ path: f.path, text }))
                  }
                >
                  <code>{f.path}</code> <span className="text-xs text-zinc-500">{f.size} B</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {open !== null && (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs text-zinc-500">
              <code>{open.path}</code>
              <Button tone="secondary" onClick={() => setOpen(null)}>
                Close
              </Button>
            </div>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-zinc-50 p-2 text-xs">
              {open.text}
            </pre>
          </div>
        )}
      </Card>
    </div>
  )
}

export const ThinkPage = () => {
  const [refreshKey, setRefreshKey] = useState(0)
  return (
    <ChatView
      harness="think"
      agentName="think-agent"
      instance="default"
      suggestions={[
        "Save a shopping list with three items to /notes/shopping.md",
        "What files are in your workspace?",
      ]}
      onTurnEnd={() => setRefreshKey((k) => k + 1)}
      side={<Side refreshKey={refreshKey} />}
    />
  )
}
