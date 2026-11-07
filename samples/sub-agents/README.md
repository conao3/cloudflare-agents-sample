# sub-agents

`SubAgentsAgent` (a `Think` agent) exposes two helper agents as tools with `agentTool`: `Researcher`, which reads allowlisted web pages with `createFetchTools`, and `Planner`. Each helper is a sub-agent with its own model loop and storage, started on demand inside the parent's Durable Object; the helper classes are exported from the Worker but need no binding.

The page subscribes to the helper runs with `useAgentToolEvents` and shows their status and summaries live. `onBeforeSubAgent` only lets the browser reach helpers that belong to a recorded run. Try it from the dashboard at `#/sub-agents`.
