import type { RpcServer } from "@cfas/mcp-rpc/types"
import type { MCPServersState } from "agents"
import { useAgent } from "agents/react"
import { useEffect, useState } from "react"
import * as z from "zod"
import { Button, Card, ConnectionBadge, Field, inputClass } from "../ui.tsx"

const emptyState: MCPServersState = { servers: {}, tools: [], prompts: [], resources: [] }

const toolResult = z.object({
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
  isError: z.boolean().optional(),
})

const serverList = z.array(
  z.object({ id: z.string(), name: z.string(), url: z.string(), state: z.string() }),
)

const exampleArgs: Record<string, string> = { add: '{ "amount": 5 }', whoami: "{}" }

export const McpRpcPage = () => {
  const [mcp, setMcp] = useState<MCPServersState>(emptyState)
  const [servers, setServers] = useState<RpcServer[]>([])
  const agent = useAgent({
    agent: "mcp-rpc-agent",
    name: "default",
    onMcpUpdate: (state) => {
      setMcp(state)
      void refresh()
    },
  })
  const connected = agent.identified
  const refresh = async () => setServers(serverList.parse(await agent.call("servers")))
  const [user, setUser] = useState("dashboard")
  const [selected, setSelected] = useState<string | null>(null)
  const [args, setArgs] = useState("{}")
  const [output, setOutput] = useState<{ text: string; error: boolean } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key)
    try {
      const result = await action()
      const parsed = toolResult.safeParse(result)
      if (parsed.success) {
        setOutput({
          text: parsed.data.content.map((c) => c.text ?? `[${c.type}]`).join("\n"),
          error: parsed.data.isError === true,
        })
      } else if (result !== undefined) {
        setOutput({ text: JSON.stringify(result, null, 2), error: false })
      }
    } catch (e) {
      setOutput({ text: e instanceof Error ? e.message : String(e), error: true })
    } finally {
      setBusy(null)
    }
  }

  useEffect(() => {
    if (connected) void refresh()
  }, [connected])
  const tool = mcp.tools.find((t) => `${t.serverId}:${t.name}` === selected)
  const argsValid = (() => {
    try {
      return z.record(z.string(), z.unknown()).safeParse(JSON.parse(args)).success
    } catch {
      return false
    }
  })()
  const connectReason = !connected
    ? "Waiting for the WebSocket connection"
    : busy !== null
      ? "Running"
      : servers.length > 0
        ? "Already connected; remove the server to connect again with other props"
        : user.trim() === ""
          ? "Enter a user name for the props"
          : undefined

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="MCP server in the same Worker">
        <div className="mb-3">
          <ConnectionBadge connected={connected} />
        </div>
        <div className="flex items-end gap-2">
          <Field label="props.user">
            <input className={inputClass} value={user} onChange={(e) => setUser(e.target.value)} />
          </Field>
          <Button
            onClick={() =>
              void run("connect", async () => {
                const result = await agent.call("addCounter", [user.trim()])
                await refresh()
                return result
              })
            }
            disabled={connectReason !== undefined}
            disabledReason={connectReason}
          >
            {busy === "connect" ? "Connecting…" : "Connect over RPC"}
          </Button>
        </div>
        <p className="mt-3 text-xs text-zinc-600">
          <code>addMcpServer("counter", env.McpRpcServer, {"{ props }"})</code> passes the Durable
          Object namespace instead of a URL, so each MCP message is a Durable Object RPC call.
        </p>
        <ul className="mt-4 flex flex-col gap-2">
          {servers.length === 0 && <li className="text-sm text-zinc-500">Not connected yet.</li>}
          {servers.map(({ id, name, state, url }) => (
            <li key={id} className="flex items-center gap-2 text-sm">
              <span className="font-medium text-zinc-900">{name}</span>
              <code className="rounded bg-zinc-100 px-1.5 text-xs">{state}</code>
              <span className="truncate text-xs text-zinc-500">{url}</span>
              <span className="ml-auto">
                <Button
                  tone="danger"
                  onClick={() => {
                    setSelected(null)
                    void run("remove", async () => {
                      await agent.call("removeCounter", [id])
                      await refresh()
                    })
                  }}
                  disabled={busy !== null}
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
          <p className="text-sm text-zinc-500">Connect to list the server's tools.</p>
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
                      setArgs(exampleArgs[t.name] ?? "{}")
                      setOutput(null)
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
        {tool === undefined && mcp.tools.length > 0 && (
          <p className="text-sm text-zinc-500">Pick a tool to call it.</p>
        )}
        {tool !== undefined && (
          <>
            <Field label={`Arguments for ${tool.name} (JSON object)`}>
              <textarea
                className={`${inputClass} font-mono`}
                rows={2}
                value={args}
                onChange={(e) => setArgs(e.target.value)}
              />
            </Field>
            <div className="mt-2">
              <Button
                onClick={() =>
                  void run("call", () =>
                    agent.call("callTool", [
                      tool.serverId,
                      tool.name,
                      z.record(z.string(), z.unknown()).parse(JSON.parse(args)),
                    ]),
                  )
                }
                disabled={busy !== null || !argsValid}
                disabledReason={busy !== null ? "Running" : "Arguments must be a JSON object"}
              >
                {busy === "call" ? "Calling…" : `Call ${tool.name}`}
              </Button>
            </div>
          </>
        )}
        {output !== null && (
          <pre
            className={`mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded p-3 text-xs ${output.error ? "bg-red-50 text-red-800" : "bg-zinc-900 text-zinc-100"}`}
          >
            {output.text}
          </pre>
        )}
      </Card>
    </div>
  )
}
