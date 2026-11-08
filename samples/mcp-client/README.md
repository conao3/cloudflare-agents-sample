# mcp-client

`McpClientAgent` connects to remote MCP servers with `addMcpServer`, keeps the connections in its storage, and calls tools with `this.mcp.callTool`. The browser receives the server list and tools through `useAgent({ onMcpUpdate })`.

A server that needs OAuth stays `authenticating` with an `auth_url`; the page opens it in a popup, and `configureOAuthCallback` answers the callback with a page that closes the popup. `configureElicitationHandlers` forwards a server's questions to the browser as `mcp-elicitation` messages and waits up to 5 minutes for `respondToElicitation`. Tool results that carry x402 payment requirements are shown as a table.

The dashboard at `#/mcp-client` has quick-add buttons for its own servers: `/mcp`, `/oauth-mcp/mcp`, `/elicit/mcp`, and `/x402/mcp`. `global_fetch_strictly_public` lets the deployed Worker reach another Worker of the same account through its public URL.
