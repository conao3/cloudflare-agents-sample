# mcp-server

A stateless MCP server: `createMcpHandler` builds a fresh `McpServer` for each request and serves it over Streamable HTTP at `/mcp`. Tools: `roll_dice`, `utc_now`, `word_count`.

Connect Claude Code with `claude mcp add --transport http cfas <dashboard URL>/mcp`, or call it from the dashboard at `#/mcp-server`.
