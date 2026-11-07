# Catalog

What the Cloudflare Agents platform offers, and the samples planned for this repository.

Sources: <https://agents.cloudflare.com/>, <https://developers.cloudflare.com/agents/>, <https://developers.cloudflare.com/agents/llms.txt>, <https://github.com/cloudflare/agents>, <https://github.com/cloudflare/agents-starter>.

## The core idea

An agent is a Durable Object: one addressable instance per name (`/agents/<class>/<name>`), with its own SQLite, state, WebSocket connections, and alarms. It sleeps when idle (no duration billing while hibernating) and wakes on an HTTP request, a WebSocket message, an email, or a scheduled task.

Packages: `agents` (core, 0.33.x), `@cloudflare/ai-chat` (`AIChatAgent`), `@cloudflare/think`, `@cloudflare/codemode`, `hono-agents`.

## Building blocks

| Block | What it does | Main API |
| ---------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
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

| Product              | Free plan                                                                                                                                                                                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workers              | 100,000 requests/day, 10 ms CPU per invocation                                                                                                                                                                                                                                                                                  |
| Durable Objects      | SQLite-backed only; 100,000 requests/day, 13,000 GB-s/day, 5 GB storage                                                                                                                                                                                                                                                         |
| Workers AI           | 10,000 Neurons/day. `@cf/zai-org/glm-4.7-flash` (function calling), `@cf/baai/bge-m3`, `@cf/deepgram/flux` (about 14 min of speech recognition a day), and `@cf/deepgram/aura-1` (about 7,300 characters of speech a day) are free; `glm-5.3-flash` (the Quick Start default), `kimi-k2.x`, and `deepseek-v4` need Workers Paid |
| Workflows            | 100,000 requests/day, 3,000 steps/day, 1,024 steps per workflow                                                                                                                                                                                                                                                                 |
| Browser Run          | 10 browser minutes/day, 3 concurrent browsers; quick actions answer 429 above a few requests per minute                                                                                                                                                                                                                         |
| Vectorize            | 30 million queried and 5 million stored vector dimensions per month                                                                                                                                                                                                                                                             |
| Email Routing        | Inbound mail is free; it needs the zone's MX to point to Cloudflare                                                                                                                                                                                                                                                             |
| AI Search            | Billing starts 2026-12-01                                                                                                                                                                                                                                                                                                       |
| Containers (Sandbox) | No free tier                                                                                                                                                                                                                                                                                                                    |

On the Free plan, going over a limit makes the request fail; nothing is billed. Workers Paid is USD 5/month. Sources: <https://developers.cloudflare.com/workers/platform/pricing/>, <https://developers.cloudflare.com/durable-objects/platform/pricing/>, <https://developers.cloudflare.com/workers-ai/platform/pricing/>, <https://developers.cloudflare.com/workers-ai/models/glm-4.7-flash/>, <https://developers.cloudflare.com/workflows/reference/pricing/>, <https://developers.cloudflare.com/browser-run/pricing/>, <https://developers.cloudflare.com/vectorize/platform/pricing/>, <https://developers.cloudflare.com/email-service/platform/pricing/>, <https://developers.cloudflare.com/ai-search/platform/limits-pricing/>.

The `AI`, `BROWSER`, and `VECTORIZE` bindings run remotely, so `wrangler dev` of those samples needs `wrangler login`.

## Samples

| Sample          | Kind   | Building blocks                                                                    |
| --------------- | ------ | ---------------------------------------------------------------------------------- |
| `state-counter` | single | Agent class, `setState`, `@callable`, `this.sql`                                   |
| `scheduler`     | single | `schedule` (delay, date, cron), `scheduleEvery`, `listSchedules`, `cancelSchedule` |
| `chat`          | single | `AIChatAgent`, Workers AI, server / browser-side / approval tools                  |
| `mcp-server`    | single | `createMcpHandler`, `McpServer`                                                    |
| `mcp-client`    | single | `addMcpServer`, `mcp.callTool`, `onMcpUpdate`                                      |
| `workflow`      | single | `runWorkflow`, `AgentWorkflow`, `waitForApproval`                                  |
| `browser`       | single | Browser Run quick actions, `createQuickActionTools`                                |
| `email`         | single | `onEmail`, `routeAgentEmail`, `replyToEmail` (simulated mail from the dashboard)   |
| `rag`           | single | Vectorize, `@cf/baai/bge-m3` embeddings, cited answers                             |
| `codemode`      | single | `createCodeTool`, `DynamicWorkerExecutor`, `worker_loaders`                        |
| `think`         | single | `Think`, workspace file tools, `submitMessages`                                    |
| `sub-agents`    | single | `agentTool`, sub-agents, `useAgentToolEvents`, `createFetchTools`                  |
| `voice`         | single | `withVoice`, `WorkersAIFluxSTT`, `WorkersAITTS`, `useVoiceAgent`                   |
| `research`      | combo  | chat + browser + approval + `scheduleEvery`                                        |
| `inbox`         | combo  | email + Vectorize + Workers AI                                                     |
| `tool-hub`      | combo  | MCP server + Browser Run + Vectorize                                               |

## Left out

| Block                                                              | Why                                                                                              |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Sandbox SDK                                                        | Runs on Containers, which have no free tier                                                      |
| AI Search                                                          | Billed from 2026-12-01                                                                           |
| Sending mail to arbitrary addresses (`send_email` / Email Service) | Needs Workers Paid                                                                               |
| Real inbound mail for `email` and `inbox`                          | The available zone's MX points to another mail provider; the samples take simulated mail instead |
