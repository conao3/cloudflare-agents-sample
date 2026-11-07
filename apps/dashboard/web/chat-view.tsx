import { useAgentChat } from "@cloudflare/ai-chat/react"
import { getToolName, isToolUIPart, type UIMessage } from "ai"
import { useAgent } from "agents/react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { InlineMarkdown } from "./markdown.tsx"
import { Button, Card, ConnectionBadge, inputClass } from "./ui.tsx"

type ToolPart = Extract<UIMessage["parts"][number], { toolCallId: string }>

const ToolCall = ({
  part,
  onApprove,
}: {
  part: ToolPart
  onApprove: (id: string, approved: boolean) => void
}) => {
  const name = getToolName(part)
  const approval = "approval" in part ? (part.approval as { id?: string } | undefined) : undefined
  const output = "output" in part ? part.output : undefined
  const errorText = "errorText" in part ? part.errorText : undefined
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs">
      <div className="mb-1 flex items-center gap-2">
        <code className="font-semibold text-zinc-800">{name}</code>
        <span className="text-zinc-500">{part.state}</span>
      </div>
      {part.input !== undefined && (
        <pre className="overflow-x-auto whitespace-pre-wrap text-zinc-600">
          {JSON.stringify(part.input, null, 2)}
        </pre>
      )}
      {output !== undefined && (
        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-green-800">
          {JSON.stringify(output, null, 2)}
        </pre>
      )}
      {errorText !== undefined && <p className="mt-1 text-red-700">{errorText}</p>}
      {part.state === "approval-requested" && approval?.id !== undefined && (
        <div className="mt-2 flex gap-2">
          <Button onClick={() => onApprove(approval.id ?? "", true)}>Approve</Button>
          <Button tone="secondary" onClick={() => onApprove(approval.id ?? "", false)}>
            Reject
          </Button>
        </div>
      )}
    </div>
  )
}

export const ChatView = ({
  agentName,
  instance,
  suggestions,
  onTurnEnd,
  side,
}: {
  agentName: string
  instance: string
  suggestions: readonly string[]
  onTurnEnd?: () => void
  side?: ReactNode
}) => {
  const agent = useAgent({ agent: agentName, name: instance })
  const { messages, sendMessage, clearHistory, addToolApprovalResponse, stop, isStreaming, error } =
    useAgentChat({
      agent,
      onToolCall: async ({ toolCall, addToolOutput }) => {
        if (toolCall.toolName === "getLocalTime") {
          addToolOutput({
            toolCallId: toolCall.toolCallId,
            output: {
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              localTime: new Date().toLocaleString(),
            },
          })
        }
      },
    })
  const [input, setInput] = useState("")
  const endRef = useRef<HTMLDivElement>(null)
  const wasStreaming = useRef(false)
  const connected = agent.identified

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" })
  }, [messages])

  useEffect(() => {
    if (wasStreaming.current && !isStreaming) onTurnEnd?.()
    wasStreaming.current = isStreaming
  }, [isStreaming, onTurnEnd])

  const send = (text: string) => {
    const trimmed = text.trim()
    if (trimmed === "" || isStreaming) return
    setInput("")
    void sendMessage({ role: "user", parts: [{ type: "text", text: trimmed }] })
  }

  const sendReason = !connected
    ? "Waiting for the WebSocket connection"
    : isStreaming
      ? "The agent is answering"
      : input.trim() === ""
        ? "Type a message"
        : undefined

  return (
    <div className={`grid gap-4 ${side === undefined ? "" : "md:grid-cols-[2fr_1fr]"}`}>
      <Card title="Conversation">
        <div className="mb-3 flex items-center justify-between">
          <ConnectionBadge connected={connected} />
          <Button
            tone="secondary"
            onClick={clearHistory}
            disabled={messages.length === 0 || isStreaming}
            disabledReason={isStreaming ? "The agent is answering" : "No messages yet"}
          >
            Clear history
          </Button>
        </div>
        <div className="mb-3 flex max-h-[28rem] min-h-48 flex-col gap-3 overflow-y-auto">
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={!connected}
                  title={connected ? undefined : "Waiting for the WebSocket connection"}
                  onClick={() => send(s)}
                  className="rounded-full border border-zinc-300 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {messages.map((message: UIMessage) => (
            <div
              key={message.id}
              className={`flex flex-col gap-1.5 ${message.role === "user" ? "items-end" : "items-start"}`}
            >
              {message.parts.map((part, i: number) => {
                if (part.type === "text") {
                  return (
                    <div
                      key={i}
                      className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${message.role === "user" ? "bg-orange-500 text-white" : "bg-zinc-100 text-zinc-900"}`}
                    >
                      <InlineMarkdown text={part.text} />
                    </div>
                  )
                }
                if (isToolUIPart(part)) {
                  return (
                    <ToolCall
                      key={part.toolCallId}
                      part={part}
                      onApprove={(id, approved) => addToolApprovalResponse({ id, approved })}
                    />
                  )
                }
                return null
              })}
            </div>
          ))}
          {isStreaming && <p className="text-xs text-zinc-500">The agent is answering…</p>}
          {error !== undefined && <p className="text-sm text-red-700">{error.message}</p>}
          <div ref={endRef} />
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            send(input)
          }}
        >
          <input
            className={`${inputClass} flex-1`}
            value={input}
            placeholder="Message"
            onChange={(e) => setInput(e.target.value)}
          />
          {isStreaming ? (
            <Button tone="secondary" onClick={() => void stop()}>
              Stop
            </Button>
          ) : (
            <Button
              onClick={() => send(input)}
              disabled={sendReason !== undefined}
              disabledReason={sendReason}
            >
              Send
            </Button>
          )}
        </form>
      </Card>
      {side}
    </div>
  )
}
