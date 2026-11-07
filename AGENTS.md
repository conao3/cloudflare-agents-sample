# AGENTS.md

- Every command runs inside `nix develop`. Use the `wrangler` from the devShell; the npm build of `workerd` does not start on NixOS. Do not add `wrangler` to any `package.json`.
- `vp run check` is the single verification command (format, lint, type check).
- One Worker per sample under `samples/<name>/` (single building block) or `combos/<name>/` (several together), named `cfas-<name>` with `workers_dev: false`. Follow "Adding a sample" in `README.md` to wire it into the dashboard.
- Types the dashboard UI needs live in the sample's `src/types.ts` (exported as `@cfas/<name>/types`) so the UI does not import Worker code. Values the UI receives from `agent.call` are parsed with zod.
- Stay inside the Workers Free plan: Workers AI models not marked paid-only (`@cf/zai-org/glm-4.7-flash`, `@cf/baai/bge-m3`), Browser Run quick actions, Vectorize, Workflows. Do not add Containers, Sandbox, AI Search, or the Email Service `send_email` binding.
- `compatibility_date` must not be newer than the date the devShell's `workerd` supports (`wrangler dev` prints the newest supported date when it is too new).
- Each agent class is a Durable Object: declare a binding and a `new_sqlite_classes` migration in `wrangler.jsonc`, and add `nodejs_compat`.
- Verify a change by running `pnpm dev` and using the sample's page in the dashboard before calling it done. Reload the tab after a rebuild: changing only the URL hash keeps the old bundle.
