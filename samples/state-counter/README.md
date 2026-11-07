# state-counter

One `CounterAgent` per name (`/agents/counter-agent/<name>`), each its own Durable Object.

- `initialState` and `this.setState()`: the count is pushed to every connected client. Open the page in two tabs and press a button in one.
- `@callable()`: `add(delta)`, `reset()`, and `history(limit)` are called from the browser over the WebSocket with `agent.call()`.
- `this.sql`: every change is written to a `history` table in the agent's SQLite.

Try it from the dashboard at `#/state-counter`. Change the name to get a fresh agent with its own state and history.
