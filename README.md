# cloudflare-agents-sample

Small, self-contained samples of the [Cloudflare Agents](https://agents.cloudflare.com/) platform. Each sample under `samples/` is one Worker that exercises one building block. Combined samples come after the single ones work.

## Layout

```
samples/<name>/
  package.json
  wrangler.jsonc
  src/index.ts
  README.md        # what it shows, how to run it, what to look at
```

The repository is a pnpm workspace (`samples/*`). Each sample deploys as its own Worker named `cfas-<name>`.

## Commands

```sh
nix develop
pnpm install
cd samples/<name>
wrangler dev        # local run on http://localhost:8787
wrangler deploy     # deploy to the logged-in Cloudflare account
```

`wrangler` comes from the Nix devShell, so its `workerd` runs on NixOS. Do not add `wrangler` to a sample's `package.json`.

## Building blocks

See [docs/catalog.md](docs/catalog.md) for what the platform offers, the free-plan limits, and the planned samples.
