# mcp-client

`McpClientAgent` connects to remote MCP servers with `addMcpServer`, keeps the connections in its storage, and calls tools with `this.mcp.callTool`. The browser receives the server list and tools through `useAgent({ onMcpUpdate })`.

The dashboard at `#/mcp-client` prefills the dashboard's own `/mcp` endpoint. `global_fetch_strictly_public` lets the deployed Worker reach another Worker of the same account through its public URL.
