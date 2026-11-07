# tool-hub

MCP server + Browser Run + RAG. One stateless MCP endpoint at `/hub/mcp` with `read_page`, `list_links` (Browser Run), `search_docs`, and `ask_docs` (the `rag` sample's Vectorize index and Workers AI).

Connect Claude Code with `claude mcp add --transport http cfas-hub <dashboard URL>/hub/mcp`, or call it from the dashboard at `#/tool-hub`.
