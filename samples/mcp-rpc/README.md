# mcp-rpc

`McpRpcAgent` connects to an MCP server that lives in the same Worker, over RPC instead of HTTP: `addMcpServer("counter", this.env.McpRpcServer, { props })` takes the Durable Object namespace of the server, and every MCP message travels as a Durable Object RPC call. There is no URL, no `fetch`, and no transport to configure.

`McpRpcServer` is an `McpAgent` (from `agents/mcp`, built on `@modelcontextprotocol/sdk` 1.x) with two tools: `add` keeps a total in the server's own state, and `whoami` returns the `props` the agent passed when it connected. `McpAgent` is feature-frozen in favor of `createMcpHandler`, and it is what the RPC transport talks to.

Try it from the dashboard at `#/mcp-rpc`: connect, list the tools, and call them.
