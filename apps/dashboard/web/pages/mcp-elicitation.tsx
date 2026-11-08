import { McpTester } from "./mcp-server.tsx"

export const McpElicitationPage = () => (
  <McpTester
    endpoint="/elicit/mcp"
    serverName="cfas-elicit"
    defaultTools={["order_coffee"]}
    defaultArgs='{ "note": "no sugar" }'
    note={
      <>
        <code>order_coffee</code> answers its first call with <code>input_required</code>: a form
        for the order and a signed <code>requestState</code>. The client retries with the answers,
        gets a confirmation question, and retries once more. The server keeps nothing between the
        requests. It accepts only the stateless protocol, so the plain JSON-RPC tester on the right
        shows the rejection. To fill in the forms, open the{" "}
        <a href="#/mcp-client" className="text-orange-700 hover:underline">
          MCP client
        </a>{" "}
        and add this server with its quick-add button.
      </>
    }
  />
)
