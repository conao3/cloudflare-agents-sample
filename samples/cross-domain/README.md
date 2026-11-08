# cross-domain

A page on one origin talking to an agent on another. The Worker routes with `routeAgentRequest(request, env, { cors: true })`, which answers the `OPTIONS` preflight and adds `Access-Control-Allow-*` headers to agent responses, so a browser on another origin may read them. The client names the agent's origin with `useAgent({ agent, name, host })`; WebSocket upgrades are not subject to CORS, so check the `Origin` header in `onBeforeConnect` when only some sites may connect.

`CrossDomainAgent` records the `Origin` header of every WebSocket connection and HTTP request, so the page shows which origin reached it and over which path.

Locally, `localhost:<port>` and `127.0.0.1:<port>` are two origins served by the same `wrangler dev`, so the dashboard page at `#/cross-domain` connects to the other one. The page also fetches a dashboard asset from the other origin, which has no CORS headers, to show the request the browser blocks. In production the agent would sit on its own hostname (for example `agents.example.com`) and the page would pass that as `host`; the deployed dashboard has a single origin, so this sample runs only with `pnpm dev`.
