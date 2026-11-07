# Catalog

What the Cloudflare Agents platform offers, and the samples planned for this repository.

Sources: <https://agents.cloudflare.com/>, <https://developers.cloudflare.com/agents/>, <https://developers.cloudflare.com/agents/llms.txt>, <https://github.com/cloudflare/agents>, <https://github.com/cloudflare/agents-starter>.

## The core idea

An agent is a Durable Object: one addressable instance per name (`/agents/<class>/<name>`), with its own SQLite, state, WebSocket connections, and alarms. It sleeps when idle (no duration billing while hibernating) and wakes on an HTTP request, a WebSocket message, an email, or a scheduled task.

Packages: `agents` (core, 0.33.x), `@cloudflare/ai-chat` (`AIChatAgent`), `@cloudflare/think`, `@cloudflare/codemode`, `hono-agents`.

## Building blocks

| Block | What it does | Main API |
|---|---|---|
| Agent class | Durable Object with lifecycle hooks | `Agent<Env, State>`, `onStart` / `onRequest` / `onConnect` / `onMessage` / `onEmail`, `routeAgentRequest(request, env)`, `getAgentByName()` |
| State | JSON state synced to every connected client | `initialState`, `this.setState()`, `onStateChanged()`; client `useAgent` (`agents/react`), `AgentClient` |
| SQL | Embedded SQLite per agent | ``this.sql`select ...` `` |
| RPC | Methods callable from the client over WebSocket | `@callable()`, `agent.stub.<method>()`, `agent.call()`, `this.broadcast()` |
| Scheduling | Delayed, dated, cron, and interval tasks | `this.schedule(when, "method", payload)`, `scheduleEvery()`, `listSchedules()` |
| AI chat | Streaming chat with persisted history, tools, human-in-the-loop approval | `AIChatAgent.onChatMessage()`, `useAgentChat` |
| Models | Workers AI (no API key) or other providers through AI Gateway | `env.AI.run(model, ...)`, `createAI` (`agents/models/ai-sdk`) |
| Harnesses | Ready-made durable agent loops | `PiHarness` (`agents/harness/pi`, experimental), OpenCode, `Think` |
| MCP server | Expose tools to Claude Code and other MCP clients | `createMcpHandler` (stateless). `McpAgent` is deprecated |
| MCP client | Let the agent use remote MCP servers | `this.addMcpServer()`, `this.mcp.getAITools()` |
| Workflows | Durable multi-step jobs with retries and approval waits | `this.runWorkflow()`, `waitForApproval()` |
| Sub-agents / agents as tools | One agent delegating to another | `subAgent()`, `runAgentTool()` |
| Queue / fibers | Background work that survives eviction | `queue()`, `runFiber()`, `keepAlive()` |
| Email | Receive mail through Email Routing and reply | `onEmail()`, `replyToEmail()` |
| Voice | Speech-to-text and text-to-speech over WebSocket | `useVoiceAgent`, `VoiceClient` |
| Browser Run | Headless Chrome: page reading, screenshots | `agents/browser` |
| Sandbox / Workspace | Linux sandbox for shell and scripts, durable filesystem | Sandbox SDK, `@cloudflare/computer` (runs on Containers) |
| Code Mode | The model writes TypeScript that calls your tools instead of single tool calls | `createCodeTool()`, `@cloudflare/codemode` |
| Search / RAG | Vector search and managed RAG | Vectorize, AI Search |
| Payments | Charge per tool call, or pay from the agent | x402 (`paidTool`, `withX402Client`), MPP |
| Channels | Chat, email, voice, Slack, webhook | channel adapters |

## Free plan limits relevant to the samples

| Product | Free plan |
|---|---|
| Workers | 100,000 requests/day, 10 ms CPU per invocation |
| Durable Objects | SQLite-backed only; 100,000 requests/day, 13,000 GB-s/day, 5 GB storage |
| Workers AI | 10,000 Neurons/day. Large models (`@cf/zai-org/glm-5.3-flash`, the Quick Start default, and `kimi-k2.x`, `deepseek-v4`) need Workers Paid |
| Workflows | 3,000 steps/day |
| Browser Run | 10 browser minutes/day, 3 concurrent browsers |
| Vectorize | Docs say Workers Paid only |
| Containers (Sandbox) | No free tier |

Workers Paid is USD 5/month. Sources: <https://developers.cloudflare.com/workers/platform/pricing/>, <https://developers.cloudflare.com/durable-objects/platform/pricing/>, <https://developers.cloudflare.com/workers-ai/platform/pricing/>, <https://developers.cloudflare.com/browser-run/pricing/>.

The `AI` binding always runs remotely, so `wrangler dev` of an AI sample needs `wrangler login`.

## Planned single samples

| Sample | Shows | Cost |
|---|---|---|
| `state-counter` | Agent class, `setState` sync to two browser tabs, `@callable` RPC, SQL | free, runs fully local |
| `scheduler` | `schedule` with delay, date, cron, and `scheduleEvery`; listing and cancelling | free, local |
| `chat` | `AIChatAgent` with a Workers AI model, persisted history, one tool with approval | free model, needs login |
| `mcp-server` | `createMcpHandler` exposing tools, used from Claude Code | free |
| `mcp-client` | Agent connecting to a remote MCP server and calling its tools | free |
| `workflow` | Workflow started from an agent, with `waitForApproval` | free |
| `browser` | Browser Run: fetch a page, take a screenshot | free within 10 min/day |
| `email` | `onEmail` through Email Routing and an auto-reply | free, needs a zone with Email Routing |
| `rag` | Vectorize or AI Search over a small document set | Workers Paid |
| `codemode` | Code Mode over a few tools | free model may be weak; check |
| `sandbox` | Sandbox SDK running a shell command | Containers, paid |

## Combined samples (after the single ones)

- Research assistant: `chat` + `browser` + `workflow` (approval before a long crawl) + `scheduler` (daily re-run).
- Inbox agent: `email` + `chat` + `mcp-client` (look things up) + reply.
- Tool hub: `mcp-server` that wraps `browser` and `rag`, used from Claude Code.
