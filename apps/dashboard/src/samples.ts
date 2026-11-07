export type SampleStatus = "ready" | "planned"

export type Sample = {
  id: string
  title: string
  summary: string
  blocks: readonly string[]
  status: SampleStatus
  cost: string
}

export type RoutedSample = Sample & {
  status: "ready"
  agent: string
  binding: "STATE_COUNTER" | "SCHEDULER"
}

export const routedSamples = [
  {
    id: "state-counter",
    title: "State counter",
    summary:
      "An agent per name with state synced to every open tab, @callable RPC, and an SQLite history table.",
    blocks: ["Agent", "setState", "@callable", "this.sql"],
    status: "ready",
    cost: "Free",
    agent: "counter-agent",
    binding: "STATE_COUNTER",
  },
  {
    id: "scheduler",
    title: "Scheduler",
    summary: "Delayed, dated, cron, and interval tasks that wake the agent and record each run.",
    blocks: ["schedule", "scheduleEvery", "listSchedules", "cancelSchedule"],
    status: "ready",
    cost: "Free",
    agent: "scheduler-agent",
    binding: "SCHEDULER",
  },
] as const satisfies readonly RoutedSample[]

export const plannedSamples = [
  {
    id: "chat",
    title: "Chat",
    summary:
      "AIChatAgent on a Workers AI model, persisted history, and a tool that waits for approval.",
    blocks: ["AIChatAgent", "Workers AI", "useAgentChat"],
    status: "planned",
    cost: "Free model",
  },
  {
    id: "mcp-server",
    title: "MCP server",
    summary: "Tools exposed with createMcpHandler and used from Claude Code.",
    blocks: ["createMcpHandler"],
    status: "planned",
    cost: "Free",
  },
  {
    id: "mcp-client",
    title: "MCP client",
    summary: "An agent that connects to a remote MCP server and calls its tools.",
    blocks: ["addMcpServer", "mcp.getAITools"],
    status: "planned",
    cost: "Free",
  },
  {
    id: "workflow",
    title: "Workflow",
    summary: "A durable multi-step Workflow started from an agent, paused for human approval.",
    blocks: ["runWorkflow", "waitForApproval"],
    status: "planned",
    cost: "Free",
  },
  {
    id: "browser",
    title: "Browser",
    summary: "Browser Run reads a page and takes a screenshot.",
    blocks: ["agents/browser"],
    status: "planned",
    cost: "Free, 10 min/day",
  },
  {
    id: "email",
    title: "Email",
    summary: "Mail received through Email Routing wakes the agent, which replies.",
    blocks: ["onEmail", "replyToEmail"],
    status: "planned",
    cost: "Free",
  },
] as const satisfies readonly Sample[]

export const samples: readonly Sample[] = [...routedSamples, ...plannedSamples]
