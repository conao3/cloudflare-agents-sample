# cloudflare-agents-sample

Small, self-contained samples of the [Cloudflare Agents](https://agents.cloudflare.com/) platform, with a dashboard to list them and try each one in the browser. Each sample exercises one building block. Combined samples come after the single ones work.

## Samples

| Sample                                 | Shows                                                                 |
| -------------------------------------- | --------------------------------------------------------------------- |
| [state-counter](samples/state-counter) | An agent per name, state synced to every tab, `@callable` RPC, SQLite |
| [scheduler](samples/scheduler)         | Delayed, dated, cron, and interval schedules                          |

Planned samples and the platform overview are in [docs/catalog.md](docs/catalog.md).

## Layout

```
apps/dashboard/      # Worker: serves the dashboard and forwards /agents/* to the samples
  src/samples.ts     # sample registry (list, routing)
  src/worker.ts
  web/               # React UI, built into apps/dashboard/dist
samples/<name>/      # one Worker per sample
  src/index.ts       # the agent
  src/types.ts       # types shared with the dashboard UI
  wrangler.jsonc
```

The dashboard Worker reaches each sample through a service binding. A request to `/agents/<agent>/<name>` goes to the sample whose agent class matches `<agent>`, so the UI connects with the standard `useAgent({ agent, name })`.

## Commands

```sh
nix develop
vp install
pnpm dev            # build the UI and run all Workers on http://localhost:8790
vp run check        # format, lint, and type check
vp run types        # regenerate worker-configuration.d.ts after editing a wrangler.jsonc
pnpm deploy         # deploy the samples, then the dashboard
```

`wrangler` comes from the Nix devShell, so its `workerd` runs on NixOS.

## Adding a sample

1. Create `samples/<name>/` with `package.json`, `wrangler.jsonc` (`name: cfas-<name>`, a Durable Object binding and `new_sqlite_classes` migration per agent class), `src/index.ts`, `src/types.ts`, and `README.md`.
2. Add a service binding to `apps/dashboard/wrangler.jsonc` and an entry to `routedSamples` in `apps/dashboard/src/samples.ts`.
3. Add a page under `apps/dashboard/web/pages/` and register it in `web/app.tsx`.
4. Add the config to the `dev` and `deploy` scripts in `package.json` and to the `types` task in `vite.config.ts`, then run `vp run types`.

## License

Apache-2.0
