# chat

`ChatAgent` extends `AIChatAgent` and streams answers from Workers AI (`@cf/zai-org/glm-4.7-flash`, inside the free daily allocation). The history is stored in the agent's SQLite.

- `getWeather`: a server tool with `execute`.
- `getLocalTime`: a tool without `execute`; the browser answers it in `useAgentChat({ onToolCall })`.
- `transferPoints`: `needsApproval` pauses the turn until the user presses Approve or Reject.

The `AI` binding is remote, so `wrangler dev` needs `wrangler login`. Try it from the dashboard at `#/chat`.
