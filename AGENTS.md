# AGENTS.md

- Every command runs inside `nix develop`. Use the `wrangler` from the devShell; the npm build of `workerd` does not start on NixOS.
- One sample per building block under `samples/<name>/`. A sample has its own `package.json`, `wrangler.jsonc`, `src/index.ts`, and `README.md`.
- Worker names are `cfas-<name>`.
- `compatibility_date` must not be newer than the date the devShell's `workerd` supports (`wrangler dev` prints the newest supported date when it is too new).
- Each agent class is a Durable Object: declare a binding and a `new_sqlite_classes` migration in `wrangler.jsonc`, and add `nodejs_compat`.
- Verify a sample by running `wrangler dev` and calling it (curl or the sample's page) before calling it done.
