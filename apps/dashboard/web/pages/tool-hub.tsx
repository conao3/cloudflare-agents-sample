import { McpTester } from "./mcp-server.tsx"

export const ToolHubPage = () => (
  <McpTester
    endpoint="/hub/mcp"
    serverName="cfas-hub"
    defaultTools={["read_page", "list_links", "search_docs", "ask_docs"]}
    defaultArgs='{ "url": "https://developers.cloudflare.com/agents/" }'
    note="search_docs and ask_docs read the documents you loaded in the RAG sample. read_page and list_links use Browser Run, which allows 10 browser minutes a day and a few requests per minute on the free plan."
  />
)
