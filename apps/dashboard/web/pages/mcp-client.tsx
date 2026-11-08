import {
  elicitationTimeoutMs,
  type ElicitationAnswer,
  type ElicitationValue,
  type PendingElicitation,
} from "@cfas/mcp-client/types"
import type { MCPServersState } from "agents"
import { useAgent } from "agents/react"
import { useCallback, useEffect, useState } from "react"
import * as z from "zod"
import { Button, Card, ConnectionBadge, Field, inputClass } from "../ui.tsx"

const emptyState: MCPServersState = { servers: {}, tools: [], prompts: [], resources: [] }

const quickAdds = [
  { name: "cfas", path: "/mcp", label: "MCP server" },
  { name: "cfas-oauth", path: "/oauth-mcp/mcp", label: "OAuth" },
  { name: "cfas-elicit", path: "/elicit/mcp", label: "Elicitation" },
  { name: "cfas-x402", path: "/x402/mcp", label: "x402" },
] as const

const propertySchema = z.object({
  type: z.enum(["string", "number", "integer", "boolean"]),
  title: z.string().optional(),
  description: z.string().optional(),
  enum: z.array(z.string()).optional(),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
})

type Property = z.infer<typeof propertySchema>

const elicitParamsSchema = z.object({
  message: z.string(),
  mode: z.string().optional(),
  url: z.string().optional(),
  requestedSchema: z
    .object({
      properties: z.record(z.string(), propertySchema),
      required: z.array(z.string()).optional(),
    })
    .optional(),
})

const pendingSchema = z.object({
  type: z.literal("mcp-elicitation"),
  id: z.string(),
  serverId: z.string(),
  params: z.unknown(),
})

const settledSchema = z.object({ type: z.literal("mcp-elicitation-settled"), id: z.string() })

const requirementSchema = z.object({
  scheme: z.string(),
  network: z.string(),
  amount: z.string().optional(),
  maxAmountRequired: z.string().optional(),
  asset: z.string(),
  payTo: z.string(),
  maxTimeoutSeconds: z.number().optional(),
  extra: z.record(z.string(), z.unknown()).optional(),
})

const paymentSchema = z.object({
  x402Version: z.number(),
  error: z.string(),
  resource: z.object({ url: z.string(), description: z.string().optional() }).optional(),
  accepts: z.array(requirementSchema).optional(),
})

type Payment = z.infer<typeof paymentSchema>

const toolResultSchema = z.object({
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
  isError: z.boolean().optional(),
  _meta: z.record(z.string(), z.unknown()).optional(),
})

type Output =
  | { kind: "text"; text: string }
  | { kind: "tool"; text: string; isError: boolean; payment: Payment | null }

const networks: Record<string, string> = {
  "eip155:84532": "Base Sepolia (testnet)",
  "eip155:8453": "Base",
}

const toOutput = (value: unknown): Output => {
  const parsed = toolResultSchema.safeParse(value)
  if (!parsed.success) return { kind: "text", text: JSON.stringify(value, null, 2) }
  const payment = paymentSchema.safeParse(parsed.data["_meta"]?.["x402/error"])
  return {
    kind: "tool",
    text: parsed.data.content.map((item) => item.text ?? JSON.stringify(item)).join("\n"),
    isError: parsed.data.isError === true,
    payment: payment.success ? payment.data : null,
  }
}

const formatAmount = (atomic: string, extra: Record<string, unknown> | undefined) => {
  const name = typeof extra?.["name"] === "string" ? extra["name"] : "units"
  const decimals = name === "USDC" ? 6 : 0
  return decimals === 0
    ? `${atomic} ${name}`
    : `${(Number(atomic) / 10 ** decimals).toFixed(decimals).replace(/\.?0+$/, "")} ${name} (${atomic} atomic units)`
}

const PaymentRequired = ({ payment }: { payment: Payment }) => (
  <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
    <p className="mb-2 font-medium text-amber-900">
      Payment required <code className="ml-1 text-xs">{payment.error}</code>
    </p>
    {payment.resource !== undefined && (
      <p className="mb-2 text-xs text-amber-900">
        {payment.resource.url}
        {payment.resource.description === undefined ? "" : ` — ${payment.resource.description}`}
      </p>
    )}
    {(payment.accepts ?? []).map((req, i) => (
      <dl
        key={`${req.network}-${req.asset}-${i}`}
        className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-zinc-800"
      >
        <dt className="text-zinc-500">Amount</dt>
        <dd>{formatAmount(req.amount ?? req.maxAmountRequired ?? "?", req.extra)}</dd>
        <dt className="text-zinc-500">Network</dt>
        <dd>
          {networks[req.network] ?? req.network} <code>{req.network}</code>
        </dd>
        <dt className="text-zinc-500">Asset</dt>
        <dd className="break-all font-mono">{req.asset}</dd>
        <dt className="text-zinc-500">Pay to</dt>
        <dd className="break-all font-mono">{req.payTo}</dd>
        <dt className="text-zinc-500">Scheme</dt>
        <dd>
          {req.scheme}
          {req.maxTimeoutSeconds === undefined ? "" : `, valid for ${req.maxTimeoutSeconds} s`}
        </dd>
      </dl>
    ))}
    <p className="mt-2 text-xs text-amber-900">
      A client with a funded testnet wallet signs this with withX402Client and retries the call.
    </p>
  </div>
)

const initialValue = (property: Property): ElicitationValue =>
  property.default ??
  (property.type === "boolean"
    ? false
    : property.enum !== undefined
      ? (property.enum[0] ?? "")
      : "")

const FieldInput = ({
  property,
  value,
  onChange,
}: {
  property: Property
  value: ElicitationValue
  onChange: (value: ElicitationValue) => void
}) => {
  if (property.type === "boolean") {
    return (
      <input
        type="checkbox"
        className="size-4 accent-orange-500"
        checked={value === true}
        onChange={(e) => onChange(e.target.checked)}
      />
    )
  }
  if (property.enum !== undefined) {
    return (
      <select
        className={inputClass}
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
      >
        {property.enum.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    )
  }
  if (property.type === "number" || property.type === "integer") {
    return (
      <input
        type="number"
        className={inputClass}
        min={property.minimum}
        max={property.maximum}
        step={property.type === "integer" ? 1 : "any"}
        value={String(value)}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
      />
    )
  }
  return (
    <input
      className={inputClass}
      value={String(value)}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

const ElicitationForm = ({
  elicitation,
  serverName,
  onRespond,
}: {
  elicitation: PendingElicitation
  serverName: string
  onRespond: (answer: ElicitationAnswer) => Promise<void>
}) => {
  const params = elicitParamsSchema.safeParse(elicitation.params)
  const properties = Object.entries(params.data?.requestedSchema?.properties ?? {})
  const required = params.data?.requestedSchema?.required ?? []
  const [values, setValues] = useState<Record<string, ElicitationValue>>(() =>
    Object.fromEntries(properties.map(([key, property]) => [key, initialValue(property)])),
  )
  const [sending, setSending] = useState(false)
  const missing = required.filter((key) => values[key] === "" || values[key] === undefined)

  const respond = async (answer: ElicitationAnswer) => {
    setSending(true)
    try {
      await onRespond(answer)
    } finally {
      setSending(false)
    }
  }

  if (!params.success) {
    return (
      <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
        Unreadable elicitation from {serverName}: {JSON.stringify(elicitation.params)}
        <div className="mt-2">
          <Button tone="secondary" onClick={() => void respond({ action: "cancel" })}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  const isUrl = params.data.mode === "url"

  return (
    <div className="rounded-md border border-orange-300 bg-orange-50 p-3">
      <p className="mb-1 text-xs text-zinc-500">{serverName} asks:</p>
      <p className="mb-3 text-sm font-medium text-zinc-900">{params.data.message}</p>
      {isUrl ? (
        <a
          href={params.data.url}
          target="_blank"
          rel="noreferrer"
          className="mb-3 block break-all text-sm text-orange-700 hover:underline"
        >
          {params.data.url}
        </a>
      ) : (
        <div className="mb-3 flex flex-col gap-2">
          {properties.map(([key, property]) => (
            <Field
              key={key}
              label={`${property.title ?? key}${required.includes(key) ? " *" : ""}${property.description === undefined ? "" : ` (${property.description})`}`}
            >
              <FieldInput
                property={property}
                value={values[key] ?? initialValue(property)}
                onChange={(value) => setValues((current) => ({ ...current, [key]: value }))}
              />
            </Field>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Button
          onClick={() =>
            void respond({
              action: "accept",
              content: isUrl
                ? {}
                : Object.fromEntries(Object.entries(values).filter(([, value]) => value !== "")),
            })
          }
          disabled={sending || missing.length > 0}
          disabledReason={sending ? "Sending" : `Fill in ${missing.join(", ")}`}
        >
          Accept
        </Button>
        <Button
          tone="secondary"
          onClick={() => void respond({ action: "decline" })}
          disabled={sending}
          disabledReason="Sending"
        >
          Decline
        </Button>
        <Button
          tone="danger"
          onClick={() => void respond({ action: "cancel" })}
          disabled={sending}
          disabledReason="Sending"
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}

const stateClass: Record<string, string> = {
  ready: "bg-green-100 text-green-800",
  authenticating: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-800",
}

const openAuthPopup = (url: string) =>
  window.open(url, "mcp-oauth", "width=520,height=720,resizable=yes,scrollbars=yes")

export const McpClientPage = () => {
  const [mcp, setMcp] = useState<MCPServersState>(emptyState)
  const [elicitations, setElicitations] = useState<PendingElicitation[]>([])
  const onMessage = useCallback((event: MessageEvent) => {
    if (typeof event.data !== "string" || !event.data.startsWith('{"type":"mcp-elicitation')) return
    const data: unknown = JSON.parse(event.data)
    const pending = pendingSchema.safeParse(data)
    if (pending.success) {
      const next = pending.data
      setElicitations((current) => [...current.filter((e) => e.id !== next.id), next])
    }
    const settled = settledSchema.safeParse(data)
    if (settled.success) {
      setElicitations((current) => current.filter((e) => e.id !== settled.data.id))
    }
  }, [])
  const agent = useAgent({
    agent: "mcp-client-agent",
    name: "default",
    onMcpUpdate: setMcp,
    onMessage,
  })
  const connected = agent.identified
  const [name, setName] = useState("cfas")
  const [url, setUrl] = useState(`${window.location.origin}/mcp`)
  const [selected, setSelected] = useState<string | null>(null)
  const [args, setArgs] = useState("{}")
  const [output, setOutput] = useState<Output | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!connected) return
    void agent
      .call("pendingElicitations", [])
      .then((list) => setElicitations(z.array(pendingSchema).parse(list)))
  }, [connected, agent])

  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key)
    try {
      const result = await action()
      if (result !== undefined) setOutput(toOutput(result))
    } catch (e) {
      setOutput({ kind: "text", text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(null)
    }
  }

  const respond = async (id: string, answer: ElicitationAnswer) => {
    await agent.call("respondToElicitation", [id, answer])
    setElicitations((current) => current.filter((e) => e.id !== id))
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
    : busy !== null
      ? "Running"
      : undefined
  const knownUrls = new Set(servers.map(([, server]) => server.server_url))

  return (
    <div className="flex flex-col gap-4">
      {elicitations.length > 0 && (
        <Card title={`Server needs your input (${elicitations.length})`}>
          <div className="flex flex-col gap-3">
            {elicitations.map((elicitation) => (
              <ElicitationForm
                key={elicitation.id}
                elicitation={elicitation}
                serverName={mcp.servers[elicitation.serverId]?.name ?? elicitation.serverId}
                onRespond={(answer) => respond(elicitation.id, answer)}
              />
            ))}
          </div>
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Servers">
          <div className="mb-3">
            <ConnectionBadge connected={connected} />
          </div>
          <p className="mb-2 text-xs text-zinc-600">Quick add a server of this dashboard:</p>
          <div className="mb-3 flex flex-wrap gap-2">
            {quickAdds.map((entry) => {
              const target = `${window.location.origin}${entry.path}`
              const added = knownUrls.has(target)
              return (
                <Button
                  key={entry.path}
                  tone="secondary"
                  onClick={() =>
                    void run(entry.path, () => agent.call("addServer", [entry.name, target]))
                  }
                  disabled={addReason !== undefined || added}
                  disabledReason={added ? `${entry.path} is already added` : addReason}
                >
                  {busy === entry.path ? "Adding…" : `${entry.label} ${entry.path}`}
                </Button>
              )
            })}
          </div>
          <div className="mb-3 grid grid-cols-[1fr_2fr] gap-2">
            <Field label="Name">
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="URL">
              <input className={inputClass} value={url} onChange={(e) => setUrl(e.target.value)} />
            </Field>
          </div>
          <Button
            onClick={() => void run("add", () => agent.call("addServer", [name, url]))}
            disabled={addReason !== undefined || name.trim() === "" || url.trim() === ""}
            disabledReason={addReason ?? "Enter a name and URL"}
          >
            {busy === "add" ? "Adding…" : "Add server"}
          </Button>
          <ul className="mt-4 flex flex-col gap-3">
            {servers.length === 0 && <li className="text-sm text-zinc-500">No servers yet.</li>}
            {servers.map(([id, server]) => (
              <li key={id} className="text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-900">{server.name}</span>
                  <code
                    className={`rounded px-1.5 text-xs ${stateClass[server.state] ?? "bg-zinc-100 text-zinc-700"}`}
                  >
                    {server.state}
                  </code>
                  <span className="truncate text-xs text-zinc-500">{server.server_url}</span>
                  <span className="ml-auto flex shrink-0 gap-1">
                    {server.state === "authenticating" && server.auth_url !== null && (
                      <Button onClick={() => openAuthPopup(server.auth_url ?? "")}>
                        Authorize
                      </Button>
                    )}
                    <Button
                      tone="danger"
                      onClick={() =>
                        void run(`remove-${id}`, () => agent.call("removeServer", [id]))
                      }
                      disabled={busy !== null}
                      disabledReason="Running"
                    >
                      Remove
                    </Button>
                  </span>
                </div>
                {server.state === "authenticating" && server.auth_url !== null && (
                  <p className="mt-1 text-xs text-amber-800">
                    Needs authorization. Authorize opens the server's consent page in a popup; the
                    popup closes itself and the tools appear.
                  </p>
                )}
                {server.error !== null && (
                  <p className="mt-1 break-all text-xs text-red-700">{server.error}</p>
                )}
              </li>
            ))}
          </ul>
        </Card>
        <Card title={`Tools (${mcp.tools.length})`}>
          {mcp.tools.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Add a server to see its tools. The quick-add buttons add this dashboard's MCP servers.
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
                      <span className="ml-2 text-xs text-zinc-400">
                        {mcp.servers[t.serverId]?.name}
                      </span>
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
                  void run("call", () =>
                    agent.call(
                      "callTool",
                      [
                        tool.serverId,
                        tool.name,
                        z.record(z.string(), z.unknown()).parse(JSON.parse(args)),
                      ],
                      { timeout: elicitationTimeoutMs + 60_000 },
                    ),
                  )
                }
                disabled={busy !== null || !argsValid}
                disabledReason={busy !== null ? "Running" : "Arguments must be valid JSON"}
              >
                {busy === "call" ? "Calling…" : "Call tool"}
              </Button>
              {busy === "call" && elicitations.length > 0 && (
                <p className="mt-2 text-xs text-orange-800">
                  The tool is waiting for your answer above.
                </p>
              )}
            </>
          )}
          {output?.kind === "text" && (
            <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded bg-zinc-900 p-3 text-xs text-zinc-100">
              {output.text}
            </pre>
          )}
          {output?.kind === "tool" && (
            <>
              {output.payment !== null ? (
                <PaymentRequired payment={output.payment} />
              ) : (
                <pre
                  className={`mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded p-3 text-xs ${output.isError ? "bg-red-950 text-red-100" : "bg-zinc-900 text-zinc-100"}`}
                >
                  {output.isError ? `Error result\n${output.text}` : output.text}
                </pre>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
