# observability

`ObservabilityAgent` replaces its `observability` sink with one that passes every event to `genericObservability` (the diagnostics channels that Tail Workers and `subscribe()` read) and also sends it to every connected client with `this.broadcast(JSON.stringify({ kind: "obs", event }))`. Each event is `{ type, agent, name, payload, timestamp }`. The sink uses `broadcast` because `setState` inside it would emit `state:update` and call the sink again.

The page at `#/observability` reads the messages with `useAgent({ onMessage })` and shows a live log with a filter per event category. Its buttons trigger:

| Button          | Events                                                |
| --------------- | ----------------------------------------------------- |
| setState        | `rpc`, `state:update`                                 |
| Call RPC        | `rpc`                                                 |
| Schedule in 3 s | `schedule:create`, then `schedule:execute`            |
| Queue a job     | `queue:create`, then `state:update` when the job runs |
| Run a 1 s fiber | `fiber:run:started`, `fiber:run:completed`            |
| Throw an error  | `rpc:error`                                           |

Opening the page emits `connect`, and closing it emits `disconnect`.

`wrangler.jsonc` sets `"observability": { "enabled": true }`, which turns on Workers Logs for the deployed Worker: `console.log` output (the scheduled and queued callbacks log a line) and each invocation appear in the Cloudflare dashboard under Workers & Pages → `cfas-observability` → Logs. On the Free plan Workers Logs takes up to 200,000 log events a day and keeps them for 3 days (<https://developers.cloudflare.com/workers/observability/logs/workers-logs/>).
