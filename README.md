# cloudflare-agents-sample

Small, self-contained samples of the [Cloudflare Agents](https://agents.cloudflare.com/) platform, with a dashboard to list them and try each one in the browser. Each single sample exercises one building block; the combined samples put several together. Everything runs on the Workers Free plan.

## Samples

| Sample                                     | Shows                                                                                               |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| [state-counter](samples/state-counter)     | An agent per name, state synced to every tab, `@callable` RPC, SQLite                               |
| [scheduler](samples/scheduler)             | Delayed, dated, cron, and interval schedules                                                        |
| [chat](samples/chat)                       | `AIChatAgent` on Workers AI with server, browser-side, and approval tools                           |
| [mcp-server](samples/mcp-server)           | A stateless MCP server with `createMcpHandler`                                                      |
| [mcp-client](samples/mcp-client)           | An agent that connects to MCP servers, authorizes with OAuth, answers elicitations, and calls tools |
| [mcp-oauth](samples/mcp-oauth)             | An MCP server behind OAuth 2.1 with `workers-oauth-provider` and a demo consent page                |
| [mcp-elicitation](samples/mcp-elicitation) | A stateless MCP tool that asks the user for input in two rounds (MRTR)                              |
| [x402](samples/x402)                       | An MCP tool priced in USDC on a testnet with x402 `paidTool`                                        |
| [workflow](samples/workflow)               | A Workflow started from an agent that waits for human approval                                      |
| [browser](samples/browser)                 | Browser Run quick actions and a model that reads pages                                              |
| [email](samples/email)                     | `onEmail` and `replyToEmail`, with simulated mail from the dashboard                                |
| [rag](samples/rag)                         | Vectorize and Workers AI embeddings with cited answers                                              |
| [codemode](samples/codemode)               | Code Mode: the model writes a program that runs in a Dynamic Worker                                 |
| [think](samples/think)                     | The Think harness: a ready-made agent loop with a workspace filesystem and background tasks         |
| [sub-agents](samples/sub-agents)           | A Think agent that hands work to Researcher and Planner sub-agents with `agentTool`                 |
| [voice](samples/voice)                     | A voice agent: Workers AI speech recognition, a model with tools, and speech                        |

| Combined sample             | Combines                               |
| --------------------------- | -------------------------------------- |
| [research](combos/research) | chat + browser + approval + scheduling |
| [inbox](combos/inbox)       | email + RAG + Workers AI               |
| [tool-hub](combos/tool-hub) | MCP server + browser + RAG             |

The platform overview, free-plan limits, and what is left out are in [docs/catalog.md](docs/catalog.md).

## Layout

```
apps/dashboard/      # Worker: serves the dashboard and forwards agent and MCP requests to the samples
  src/samples.ts     # sample registry (list, routing)
  src/worker.ts
  web/               # React UI, built into apps/dashboard/dist
samples/<name>/      # one Worker per single sample
combos/<name>/       # one Worker per combined sample
  src/index.ts
  src/types.ts       # types shared with the dashboard UI (when the UI needs them)
  wrangler.jsonc
scripts/workers.sh   # dev, deploy, and types over every Worker
```

The dashboard Worker reaches each sample through a service binding: `/agents/<agent>/<name>` goes to the sample that owns `<agent>`, and the MCP endpoints (`/mcp`, `/oauth-mcp/*` with its `/.well-known/oauth-*` documents, `/elicit/mcp`, `/x402/mcp`, `/hub/mcp`) go to the MCP servers. The UI connects with the standard `useAgent({ agent, name })`. The sample Workers have `workers_dev: false`, so the dashboard is their only public entry.

## Commands

```sh
nix develop
vp install
pnpm dev            # build the UI and run every Worker on http://localhost:8790
vp run check        # format, lint, and type check
vp run types        # regenerate worker-configuration.d.ts after editing a wrangler.jsonc
pnpm deploy         # deploy the samples and combos, then the dashboard
```

`wrangler` comes from the Nix devShell, so its `workerd` runs on NixOS. Samples that use Workers AI, Browser Run, or Vectorize use remote bindings and need `wrangler login`. The RAG samples need the Vectorize index once:

```sh
wrangler vectorize create cfas-rag --dimensions=1024 --metric=cosine
```

## Adding a sample

1. Create `samples/<name>/` (or `combos/<name>/`) with `package.json`, `wrangler.jsonc` (`name: cfas-<name>`, `workers_dev: false`, a Durable Object binding and `new_sqlite_classes` migration per agent class), `src/index.ts`, and `README.md`.
2. Add a service binding to `apps/dashboard/wrangler.jsonc` and an entry to `samples` in `apps/dashboard/src/samples.ts`.
3. Add a page under `apps/dashboard/web/pages/` and register it in `web/app.tsx`.
4. Run `vp install` and `vp run types`.

## License

Apache-2.0
