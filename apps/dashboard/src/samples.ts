export type Binding =
  | "STATE_COUNTER"
  | "SCHEDULER"
  | "CHAT"
  | "MCP_SERVER"
  | "MCP_CLIENT"
  | "WORKFLOW"
  | "BROWSER"
  | "EMAIL"
  | "RAG"
  | "CODEMODE"
  | "THINK"
  | "SUB_AGENTS"
  | "VOICE"
  | "QUEUE_FIBER"
  | "OBSERVABILITY"
  | "RESEARCH"
  | "INBOX"
  | "TOOL_HUB"

export type Sample = {
  id: string
  kind: "single" | "combo"
  title: string
  summary: string
  blocks: readonly string[]
  cost: string
  binding: Binding
  agents: readonly string[]
  paths: readonly string[]
  localOnly?: string
}

export const samples = [
  {
    id: "state-counter",
    kind: "single",
    title: "State counter",
    summary:
      "An agent per name with state synced to every open tab, @callable RPC, and an SQLite history table.",
    blocks: ["Agent", "setState", "@callable", "this.sql"],
    cost: "Free",
    binding: "STATE_COUNTER",
    agents: ["counter-agent"],
    paths: [],
  },
  {
    id: "scheduler",
    kind: "single",
    title: "Scheduler",
    summary: "Delayed, dated, cron, and interval tasks that wake the agent and record each run.",
    blocks: ["schedule", "scheduleEvery", "listSchedules", "cancelSchedule"],
    cost: "Free",
    binding: "SCHEDULER",
    agents: ["scheduler-agent"],
    paths: [],
  },
  {
    id: "chat",
    kind: "single",
    title: "Chat",
    summary:
      "AIChatAgent on a Workers AI model with persisted history, a server tool, a browser-side tool, and a tool that waits for approval.",
    blocks: ["AIChatAgent", "Workers AI", "useAgentChat", "needsApproval"],
    cost: "Free (Workers AI daily allocation)",
    binding: "CHAT",
    agents: ["chat-agent"],
    paths: [],
  },
  {
    id: "mcp-server",
    kind: "single",
    title: "MCP server",
    summary:
      "A stateless MCP server made with createMcpHandler, served at /mcp for Claude Code and other clients.",
    blocks: ["createMcpHandler", "McpServer"],
    cost: "Free",
    binding: "MCP_SERVER",
    agents: [],
    paths: ["/mcp"],
  },
  {
    id: "mcp-client",
    kind: "single",
    title: "MCP client",
    summary: "An agent that connects to remote MCP servers, lists their tools, and calls them.",
    blocks: ["addMcpServer", "mcp.callTool", "onMcpUpdate"],
    cost: "Free",
    binding: "MCP_CLIENT",
    agents: ["mcp-client-agent"],
    paths: [],
  },
  {
    id: "workflow",
    kind: "single",
    title: "Workflow",
    summary:
      "A durable multi-step Workflow started from an agent that pauses until a human approves or rejects it.",
    blocks: ["runWorkflow", "AgentWorkflow", "waitForApproval", "onWorkflowProgress"],
    cost: "Free (3,000 steps/day)",
    binding: "WORKFLOW",
    agents: ["workflow-agent"],
    paths: [],
  },
  {
    id: "browser",
    kind: "single",
    title: "Browser",
    summary:
      "Browser Run quick actions: page to Markdown, links, screenshots, and a model that reads a page to answer.",
    blocks: ["agents/browser", "Browser Run", "createQuickActionTools"],
    cost: "Free (10 browser minutes/day)",
    binding: "BROWSER",
    agents: ["browser-agent"],
    paths: [],
  },
  {
    id: "email",
    kind: "single",
    title: "Email",
    summary:
      "An agent that receives mail, keeps an inbox, and replies. The dashboard injects simulated mail.",
    blocks: ["onEmail", "routeAgentEmail", "replyToEmail"],
    cost: "Free",
    binding: "EMAIL",
    agents: ["email-agent"],
    paths: [],
  },
  {
    id: "rag",
    kind: "single",
    title: "RAG",
    summary:
      "Documents chunked and embedded into Vectorize, searched by meaning, and used to answer with citations.",
    blocks: ["Vectorize", "Workers AI embeddings", "generateText"],
    cost: "Free (Vectorize free tier)",
    binding: "RAG",
    agents: ["rag-agent"],
    paths: [],
  },
  {
    id: "codemode",
    kind: "single",
    title: "Code Mode",
    summary:
      "The model writes one JavaScript program that calls the todo tools, run in a sandboxed Dynamic Worker.",
    blocks: ["createCodeTool", "DynamicWorkerExecutor", "worker_loaders"],
    cost: "Free (Workers AI daily allocation)",
    binding: "CODEMODE",
    agents: ["codemode-agent"],
    paths: [],
    localOnly: "Dynamic Workers need Workers Paid, so this sample runs only with pnpm dev.",
  },
  {
    id: "think",
    kind: "single",
    title: "Think harness",
    summary:
      "The Think base class: a ready-made durable agent loop with a persistent workspace filesystem, file tools, and background tasks submitted with submitMessages.",
    blocks: ["Think", "getModel", "workspace", "submitMessages"],
    cost: "Free (Workers AI daily allocation)",
    binding: "THINK",
    agents: ["think-agent"],
    paths: [],
  },
  {
    id: "sub-agents",
    kind: "single",
    title: "Sub-agents",
    summary:
      "A Think agent that hands work to Researcher and Planner sub-agents with agentTool; each helper runs its own loop and storage, and progress streams to the page.",
    blocks: ["agentTool", "sub-agents", "useAgentToolEvents", "createFetchTools"],
    cost: "Free (Workers AI daily allocation)",
    binding: "SUB_AGENTS",
    agents: ["sub-agents-agent"],
    paths: [],
  },
  {
    id: "voice",
    kind: "single",
    title: "Voice",
    summary:
      "Talk to an agent: microphone audio over WebSocket, Deepgram Flux speech recognition, a model with tools, and Deepgram Aura speech, all on Workers AI.",
    blocks: ["withVoice", "WorkersAIFluxSTT", "WorkersAITTS", "useVoiceAgent"],
    cost: "Free (about 14 min of speech recognition a day)",
    binding: "VOICE",
    agents: ["voice-agent"],
    paths: [],
  },
  {
    id: "queue-fiber",
    kind: "single",
    title: "Queue and fibers",
    summary:
      "Background work that survives eviction: a FIFO task queue with retries, and a durable fiber that checkpoints with stash and resumes from the checkpoint after a restart.",
    blocks: ["queue", "dequeue", "startFiber", "stash", "onFiberRecovered", "cancelFiber"],
    cost: "Free",
    binding: "QUEUE_FIBER",
    agents: ["queue-fiber-agent"],
    paths: [],
  },
  {
    id: "observability",
    kind: "single",
    title: "Observability",
    summary:
      "A custom observability sink that still publishes every agent event and also streams it to the page as a live log, with Workers Logs enabled.",
    blocks: ["observability", "genericObservability", "broadcast", "Workers Logs"],
    cost: "Free (200,000 log events/day)",
    binding: "OBSERVABILITY",
    agents: ["observability-agent"],
    paths: [],
  },
  {
    id: "research",
    kind: "combo",
    title: "Research assistant",
    summary:
      "Chat + Browser Run + approval + scheduling: the model reads pages, and after you approve it, re-reads a page on an interval and keeps summaries.",
    blocks: ["AIChatAgent", "Browser Run", "needsApproval", "scheduleEvery"],
    cost: "Free (Workers AI + 10 browser minutes/day)",
    binding: "RESEARCH",
    agents: ["research-agent"],
    paths: [],
  },
  {
    id: "inbox",
    kind: "combo",
    title: "Support inbox",
    summary:
      "Email + RAG + Workers AI: each incoming mail is answered from the documents stored by the RAG sample, with the sources it used.",
    blocks: ["onEmail", "Vectorize", "generateText", "replyToEmail"],
    cost: "Free",
    binding: "INBOX",
    agents: ["inbox-agent"],
    paths: [],
  },
  {
    id: "tool-hub",
    kind: "combo",
    title: "Tool hub (MCP)",
    summary:
      "MCP server + Browser Run + RAG: one MCP endpoint that lets Claude Code read web pages and search or ask the RAG documents.",
    blocks: ["createMcpHandler", "Browser Run", "Vectorize"],
    cost: "Free (10 browser minutes/day)",
    binding: "TOOL_HUB",
    agents: [],
    paths: ["/hub/mcp"],
  },
] as const satisfies readonly Sample[]

export const plannedSamples = [
  {
    id: "sandbox",
    kind: "single",
    title: "Sandbox",
    summary: "The Sandbox SDK running shell commands in a container.",
    blocks: ["Sandbox SDK", "Containers"],
    cost: "Needs Workers Paid (Containers have no free tier)",
  },
] as const

const agentPath = /^\/agents\/([^/]+)(\/|$)/

export const findSample = (pathname: string): Sample | undefined => {
  const agent = agentPath.exec(pathname)?.[1]
  return samples.find(
    (s: Sample) =>
      (agent !== undefined && s.agents.includes(agent)) ||
      s.paths.some((p) => pathname === p || pathname.startsWith(`${p}/`)),
  )
}
