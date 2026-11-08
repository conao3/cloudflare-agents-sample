import { useState, type ReactNode } from "react"
import * as z from "zod"
import { Button, Card, Field, inputClass } from "../ui.tsx"

const rpcSchema = z.object({
  result: z.unknown().optional(),
  error: z.object({ message: z.string() }).optional(),
})

type RpcResult = z.infer<typeof rpcSchema>

const toolsSchema = z.object({
  tools: z.array(z.object({ name: z.string(), description: z.string().optional() })),
})

const contentSchema = z.object({
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
})

const showResult = (res: RpcResult): string => {
  const parsed = contentSchema.safeParse(res.result)
  if (!parsed.success) return JSON.stringify(res, null, 2)
  return parsed.data.content.map((item) => item.text ?? JSON.stringify(item)).join("\n")
}

const parseResponse = async (response: Response): Promise<RpcResult> => {
  const body = await response.text()
  if (!response.ok) {
    const challenge = response.headers.get("www-authenticate")
    throw new Error(
      [`HTTP ${response.status}`, challenge === null ? "" : `WWW-Authenticate: ${challenge}`, body]
        .filter(Boolean)
        .join("\n"),
    )
  }
  if ((response.headers.get("content-type") ?? "").includes("text/event-stream")) {
    const data = body
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .at(-1)
    return rpcSchema.parse(JSON.parse(data ?? "{}"))
  }
  return rpcSchema.parse(JSON.parse(body))
}

const rpc = async (endpoint: string, method: string, params: unknown): Promise<RpcResult> =>
  parseResponse(
    await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method, params }),
    }),
  )

type Tool = { name: string; description?: string }

export const McpTester = ({
  endpoint,
  serverName,
  defaultTools,
  defaultArgs,
  note,
}: {
  endpoint: string
  serverName: string
  defaultTools: readonly string[]
  defaultArgs: string
  note: ReactNode
}) => {
  const url = `${window.location.origin}${endpoint}`
  const [tools, setTools] = useState<Tool[]>([])
  const [tool, setTool] = useState(defaultTools[0] ?? "")
  const [args, setArgs] = useState(defaultArgs)
  const [output, setOutput] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    try {
      await action()
    } catch (e) {
      setOutput(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const listTools = () =>
    run(async () => {
      const res = await rpc(endpoint, "tools/list", {})
      setTools(toolsSchema.safeParse(res.result).data?.tools ?? [])
      setOutput(JSON.stringify(res, null, 2))
    })

  const callTool = () =>
    run(async () => {
      const res = await rpc(endpoint, "tools/call", {
        name: tool,
        arguments: z.record(z.string(), z.unknown()).parse(JSON.parse(args)),
      })
      setOutput(showResult(res))
    })

  const argsValid = (() => {
    try {
      JSON.parse(args)
      return true
    } catch {
      return false
    }
  })()

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Connect a client">
        <p className="mb-2 text-sm text-zinc-700">Endpoint (Streamable HTTP):</p>
        <code className="mb-3 block rounded bg-zinc-100 px-2 py-1 text-sm">{url}</code>
        <p className="mb-2 text-sm text-zinc-700">Claude Code:</p>
        <code className="mb-3 block rounded bg-zinc-100 px-2 py-1 text-xs">
          claude mcp add --transport http {serverName} {url}
        </code>
        <div className="text-sm text-zinc-700">{note}</div>
      </Card>
      <Card title="Try it from the browser">
        <div className="mb-3 flex gap-2">
          <Button
            tone="secondary"
            onClick={() => void listTools()}
            disabled={busy}
            disabledReason="Running"
          >
            tools/list
          </Button>
        </div>
        <div className="mb-3 grid grid-cols-[1fr_2fr] gap-2">
          <Field label="Tool">
            <select className={inputClass} value={tool} onChange={(e) => setTool(e.target.value)}>
              {(tools.length === 0 ? defaultTools.map((name) => ({ name })) : tools).map((t) => (
                <option key={t.name}>{t.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Arguments (JSON)">
            <input className={inputClass} value={args} onChange={(e) => setArgs(e.target.value)} />
          </Field>
        </div>
        <Button
          onClick={() => void callTool()}
          disabled={busy || !argsValid}
          disabledReason={busy ? "Running" : "Arguments must be valid JSON"}
        >
          tools/call
        </Button>
        {output !== null && (
          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded bg-zinc-900 p-3 text-xs text-zinc-100">
            {output}
          </pre>
        )}
      </Card>
    </div>
  )
}

export const McpServerPage = () => (
  <McpTester
    endpoint="/mcp"
    serverName="cfas"
    defaultTools={["roll_dice", "utc_now", "word_count"]}
    defaultArgs='{ "count": 3, "sides": 6 }'
    note="The MCP client sample can connect to this URL too. The server is stateless: each request builds a fresh McpServer."
  />
)
