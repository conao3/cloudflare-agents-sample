import type { MCPServersState } from "agents"
import { useAgent } from "agents/react"
import { useState } from "react"
import * as z from "zod"
import { Button, Card, ConnectionBadge, Field, inputClass } from "../ui.tsx"

const emptyState: MCPServersState = { servers: {}, tools: [], prompts: [], resources: [] }

export const McpClientPage = () => {
  const [mcp, setMcp] = useState<MCPServersState>(emptyState)
  const agent = useAgent({ agent: "mcp-client-agent", name: "default", onMcpUpdate: setMcp })
  const connected = agent.identified
  const [name, setName] = useState("cfas")
  const [url, setUrl] = useState(`${window.location.origin}/mcp`)
  const [selected, setSelected] = useState<string | null>(null)
  const [args, setArgs] = useState("{}")
  const [output, setOutput] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    try {
      const result = await action()
      if (result !== undefined) setOutput(JSON.stringify(result, null, 2))
    } catch (e) {
      setOutput(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const servers = Object.entries(mcp.servers)
  const tool = mcp.tools.find((t) => `${t.serverId}:${t.name}` === selected)
  const argsValid = (() => {
    try {
      JSON.parse(args)
      return true
    } catch {
      return false
    }
  })()
  const addReason = !connected
    ? "Waiting for the WebSocket connection"
    : busy
      ? "Running"
      : undefined

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Servers">
        <div className="mb-3">
          <ConnectionBadge connected={connected} />
        </div>
        <div className="mb-3 grid grid-cols-[1fr_2fr] gap-2">
          <Field label="Name">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="URL">
            <input className={inputClass} value={url} onChange={(e) => setUrl(e.target.value)} />
          </Field>
        </div>
        <Button
          onClick={() => void run(() => agent.call("addServer", [name, url]))}
          disabled={addReason !== undefined || name.trim() === "" || url.trim() === ""}
          disabledReason={addReason ?? "Enter a name and URL"}
        >
          Add server
        </Button>
        <ul className="mt-4 flex flex-col gap-2">
          {servers.length === 0 && <li className="text-sm text-zinc-500">No servers yet.</li>}
          {servers.map(([id, server]) => (
            <li key={id} className="flex items-center gap-2 text-sm">
              <span className="font-medium text-zinc-900">{server.name}</span>
              <code className="rounded bg-zinc-100 px-1.5 text-xs">{server.state}</code>
              <span className="truncate text-xs text-zinc-500">{server.server_url}</span>
              <span className="ml-auto flex gap-1">
                <Button
                  tone="danger"
                  onClick={() => void run(() => agent.call("removeServer", [id]))}
                  disabled={busy}
                  disabledReason="Running"
                >
                  Remove
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title={`Tools (${mcp.tools.length})`}>
        {mcp.tools.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Add a server to see its tools. The dashboard's own MCP server is prefilled.
          </p>
        ) : (
          <ul className="mb-3 flex flex-col gap-1">
            {mcp.tools.map((t) => {
              const key = `${t.serverId}:${t.name}`
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(key)
                      setArgs("{}")
                    }}
                    className={`w-full rounded px-2 py-1 text-left text-sm ${selected === key ? "bg-orange-100" : "hover:bg-zinc-50"}`}
                  >
                    <code className="font-semibold">{t.name}</code>
                    <span className="ml-2 text-zinc-500">{t.description}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {tool !== undefined && (
          <>
            <Field label={`Arguments for ${tool.name} (JSON)`}>
              <textarea
                className={`${inputClass} font-mono`}
                rows={3}
                value={args}
                onChange={(e) => setArgs(e.target.value)}
              />
            </Field>
            <pre className="my-2 max-h-32 overflow-auto rounded bg-zinc-50 p-2 text-xs text-zinc-600">
              {JSON.stringify(tool.inputSchema, null, 2)}
            </pre>
            <Button
              onClick={() =>
                void run(() =>
                  agent.call("callTool", [
                    tool.serverId,
                    tool.name,
                    z.record(z.string(), z.unknown()).parse(JSON.parse(args)),
                  ]),
                )
              }
              disabled={busy || !argsValid}
              disabledReason={busy ? "Running" : "Arguments must be valid JSON"}
            >
              Call tool
            </Button>
          </>
        )}
        {output !== null && (
          <pre className="mt-3 max-h-80 overflow-auto rounded bg-zinc-900 p-3 text-xs text-zinc-100">
            {output}
          </pre>
        )}
      </Card>
    </div>
  )
}
