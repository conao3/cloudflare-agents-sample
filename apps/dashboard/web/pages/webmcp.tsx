import { registerWebMcp, type WebMcpHandle } from "agents/experimental/webmcp"
import { useCallback, useEffect, useRef, useState } from "react"
import * as z from "zod"
import { samples } from "../../src/samples.ts"
import { Button, Card, Field, formatTime, inputClass } from "../ui.tsx"

type ModelContext = NonNullable<Navigator["modelContext"]>

type PageTool = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  defaultArgs: string
  execute: (input: Record<string, unknown>) => Promise<string>
}

type RemoteTool = { name: string; description: string }

type BridgeStatus = "idle" | "connecting" | "connected" | "no-op" | "error"

type LogEntry = { id: number; at: string; text: string; tone: "info" | "error" }

const remotePrefix = "remote."

const documentContext = (): ModelContext | undefined =>
  (document as Document & { modelContext?: ModelContext }).modelContext

const support = {
  navigator: navigator.modelContext !== undefined,
  document: documentContext() !== undefined,
}

const pageContext = (): ModelContext | undefined => navigator.modelContext ?? documentContext()

const argsSchema = z.record(z.string(), z.unknown())

const stringArg = (input: Record<string, unknown>, key: string): string =>
  z.string().parse(input[key])

const createPageTools = (setBanner: (text: string) => void): PageTool[] => [
  {
    name: "page.get_info",
    description: "Read the dashboard page title, URL, and viewport size",
    inputSchema: { type: "object", properties: {} },
    defaultArgs: "{}",
    execute: async () =>
      JSON.stringify({
        title: document.title,
        url: window.location.href,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      }),
  },
  {
    name: "page.set_banner",
    description: "Show a message in the banner at the top of the WebMCP page",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string", description: "Message to show" } },
      required: ["text"],
    },
    defaultArgs: '{ "text": "Hello from a page tool" }',
    execute: async (input) => {
      const text = stringArg(input, "text")
      setBanner(text)
      return `Banner set to "${text}"`
    },
  },
  {
    name: "page.find_samples",
    description: "Search the samples on this dashboard by title, summary, or building block",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "Word to look for" } },
      required: ["query"],
    },
    defaultArgs: '{ "query": "schedule" }',
    execute: async (input) => {
      const query = stringArg(input, "query").toLowerCase()
      const found = samples
        .filter((s) =>
          [s.title, s.summary, ...s.blocks].some((text) => text.toLowerCase().includes(query)),
        )
        .map((s) => ({ id: s.id, title: s.title, url: `${window.location.origin}/#/${s.id}` }))
      return JSON.stringify(found)
    },
  },
]

const Badge = ({ ok, label }: { ok: boolean; label: string }) => (
  <span
    className={`rounded-full px-2 py-0.5 text-xs ${ok ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-600"}`}
  >
    {label}: {ok ? "available" : "missing"}
  </span>
)

const PageToolRow = ({
  tool,
  registered,
  onResult,
}: {
  tool: PageTool
  registered: boolean
  onResult: (text: string, tone: LogEntry["tone"]) => void
}) => {
  const [args, setArgs] = useState(tool.defaultArgs)
  const [output, setOutput] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const parsed = (() => {
    try {
      return argsSchema.safeParse(JSON.parse(args)).data
    } catch {
      return undefined
    }
  })()

  const invoke = async () => {
    if (parsed === undefined) return
    setBusy(true)
    try {
      const result = await tool.execute(parsed)
      setOutput(result)
      onResult(`${tool.name} → ${result}`, "info")
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e)
      setOutput(text)
      onResult(`${tool.name} failed: ${text}`, "error")
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="rounded-md border border-zinc-200 p-3">
      <div className="mb-1 flex items-center gap-2">
        <code className="text-sm font-medium text-zinc-900">{tool.name}</code>
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${registered ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-600"}`}
        >
          {registered ? "registered with WebMCP" : "page only"}
        </span>
      </div>
      <p className="mb-2 text-sm text-zinc-600">{tool.description}</p>
      <div className="flex items-end gap-2">
        <Field label="Arguments (JSON)">
          <input
            className={`${inputClass} w-80`}
            value={args}
            onChange={(e) => setArgs(e.target.value)}
          />
        </Field>
        <Button
          onClick={() => void invoke()}
          disabled={busy || parsed === undefined}
          disabledReason={busy ? "Running" : "Arguments must be a JSON object"}
        >
          Invoke
        </Button>
      </div>
      {output !== null && (
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-zinc-50 p-2 text-xs text-zinc-700">
          {output}
        </pre>
      )}
    </li>
  )
}

export const WebmcpPage = () => {
  const [banner, setBanner] = useState("No banner yet. Invoke page.set_banner to change it.")
  const [tools] = useState(() => createPageTools(setBanner))
  const [status, setStatus] = useState<BridgeStatus>("idle")
  const [remoteTools, setRemoteTools] = useState<RemoteTool[]>([])
  const [log, setLog] = useState<LogEntry[]>([])
  const handle = useRef<WebMcpHandle | null>(null)
  const nextId = useRef(0)
  const generation = useRef(0)

  const addLog = useCallback((text: string, tone: LogEntry["tone"] = "info") => {
    nextId.current += 1
    const entry = { id: nextId.current, at: new Date().toISOString(), text, tone }
    setLog((entries) => [entry, ...entries].slice(0, 30))
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    for (const tool of tools) {
      pageContext()?.registerTool(
        {
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          execute: (input) => tool.execute(input),
        },
        { signal: controller.signal },
      )
    }
    return () => controller.abort()
  }, [tools])

  const release = useCallback(async () => {
    generation.current += 1
    const current = handle.current
    handle.current = null
    await current?.dispose()
  }, [])

  const connect = useCallback(async () => {
    const own = generation.current
    setStatus("connecting")
    try {
      const h = await registerWebMcp({
        url: "/mcp",
        prefix: remotePrefix,
        watch: false,
        quiet: true,
        onSync: (synced) => {
          if (own !== generation.current) return
          setRemoteTools(
            synced.map((t) => ({
              name: `${remotePrefix}${t.name}`,
              description: t.description ?? "",
            })),
          )
        },
        onError: (e) => addLog(`Background sync failed: ${e.message}`, "error"),
      })
      if (own !== generation.current) {
        await h.dispose()
        return
      }
      handle.current = h
      if (navigator.modelContext === undefined) {
        setStatus("no-op")
        addLog("registerWebMcp returned a no-op handle: navigator.modelContext is missing")
      } else {
        setStatus("connected")
        addLog(`Bridged ${h.tools.length} tool(s) from /mcp: ${h.tools.join(", ")}`)
      }
    } catch (e) {
      setStatus("error")
      addLog(`Bridge failed: ${e instanceof Error ? e.message : String(e)}`, "error")
    }
  }, [addLog])

  const disconnect = async () => {
    await release()
    setRemoteTools([])
    setStatus("idle")
    addLog("Disposed the bridge; the remote tools are unregistered")
  }

  const refresh = async () => {
    await handle.current?.refresh()
    addLog(`Refreshed: ${handle.current?.tools.length ?? 0} remote tool(s)`)
  }

  useEffect(() => {
    void connect()
    return () => {
      void release()
    }
  }, [connect, release])

  const supported = support.navigator || support.document
  const bridgeLabel: Record<BridgeStatus, string> = {
    idle: "Not connected",
    connecting: "Connecting to /mcp…",
    connected: `Connected: ${remoteTools.length} tool(s) registered`,
    "no-op": "No-op: the bridge needs navigator.modelContext and made no request",
    error: "Failed; see the log",
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
        {banner}
      </div>
      <Card title="Browser support">
        <div className="mb-3 flex flex-wrap gap-2">
          <Badge ok={support.navigator} label="navigator.modelContext" />
          <Badge ok={support.document} label="document.modelContext" />
        </div>
        {supported ? (
          <p className="text-sm text-green-700">
            WebMCP is available. A browser agent can now see the page tools and the bridged{" "}
            <code>remote.*</code> tools.
          </p>
        ) : (
          <p className="text-sm text-zinc-700">
            This browser does not expose WebMCP, so nothing is registered and nothing throws. The
            Invoke buttons below still run the page tools directly.
          </p>
        )}
        <p className="mt-3 text-xs text-zinc-500">
          WebMCP is an early preview. To let a browser agent call these tools, open this page in
          Chrome with <code>chrome://flags/#enable-webmcp-testing</code> enabled (and{" "}
          <code>#enable-experimental-web-platform-features</code> if your build needs it), then use
          an extension that lists and calls WebMCP tools, or chrome-devtools-mcp with WebMCP
          support. <code>agents/experimental/webmcp</code> is experimental and changes between
          releases.
        </p>
      </Card>
      <Card title={`Page-local tools (${tools.length})`}>
        <p className="mb-3 text-xs text-zinc-500">
          Registered with <code>modelContext.registerTool</code> and removed with an{" "}
          <code>AbortSignal</code> when you leave the page. They run in the page, so they can read
          and change the DOM.
        </p>
        <ul className="flex flex-col gap-2">
          {tools.map((tool) => (
            <PageToolRow key={tool.name} tool={tool} registered={supported} onResult={addLog} />
          ))}
        </ul>
      </Card>
      <Card title="Bridged from the MCP server at /mcp">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-zinc-700">{bridgeLabel[status]}</span>
          <span className="ml-auto flex gap-2">
            <Button
              tone="secondary"
              onClick={() => void refresh()}
              disabled={status !== "connected"}
              disabledReason="The bridge is not connected"
            >
              Refresh
            </Button>
            {status === "idle" ? (
              <Button onClick={() => void connect()}>Connect</Button>
            ) : (
              <Button
                tone="secondary"
                onClick={() => void disconnect()}
                disabled={status === "connecting"}
                disabledReason="Connecting"
              >
                Disconnect
              </Button>
            )}
          </span>
        </div>
        {remoteTools.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No remote tools registered.{" "}
            {status === "no-op" &&
              "Without WebMCP the adapter skips the MCP connection; the MCP server sample page calls /mcp directly."}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {remoteTools.map((tool) => (
              <li key={tool.name} className="text-sm">
                <code className="font-medium text-zinc-900">{tool.name}</code>{" "}
                <span className="text-zinc-600">{tool.description}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-zinc-500">
          <code>
            registerWebMcp(&#123; url: &quot;/mcp&quot;, prefix: &quot;remote.&quot;, watch: false
            &#125;)
          </code>{" "}
          lists the tools of the MCP server sample and registers one WebMCP tool per MCP tool; calls
          go back to <code>/mcp</code> as <code>tools/call</code>. The server is stateless and
          cannot push <code>tools/list_changed</code>, so <code>watch</code> is off and Refresh
          lists the tools again. Remote tools are for the browser agent, so the page does not invoke
          them.
        </p>
      </Card>
      <Card title="Log">
        {log.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing yet.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-xs">
            {log.map((entry) => (
              <li
                key={entry.id}
                className={entry.tone === "error" ? "text-red-700" : "text-zinc-700"}
              >
                <span className="text-zinc-400">{formatTime(entry.at)}</span> {entry.text}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
