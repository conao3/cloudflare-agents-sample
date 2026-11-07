# storage

Three places an agent can keep data, side by side:

- The agent's own state and SQLite (`setState`, `this.sql`): private to one agent instance.
- D1 (`env.DB`): one SQL database shared by every agent and Worker; here a guestbook table created in `onStart`.
- KV (`env.KV`): small values with an expiry (`expirationTtl`, at least 60 seconds); `list` is eventually consistent.

The D1 database and KV namespace have no ids in `wrangler.jsonc`: `wrangler dev` creates local ones and `wrangler deploy` provisions them in the account. Try it from the dashboard at `#/storage`.
