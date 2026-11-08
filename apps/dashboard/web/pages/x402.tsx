import { McpTester } from "./mcp-server.tsx"

export const X402Page = () => (
  <McpTester
    endpoint="/x402/mcp"
    serverName="cfas-x402"
    defaultTools={["premium_fortune", "free_fortune"]}
    defaultArgs='{ "topic": "Durable Objects" }'
    note={
      <>
        <code>premium_fortune</code> costs USD 0.01 in USDC on Base Sepolia (testnet). A call
        without a payment returns an error result whose <code>_meta["x402/error"]</code> holds the
        payment requirements: amount, asset, network, and the address to pay. A client with a funded
        testnet wallet (<code>withX402Client</code>) would sign a payment and retry. The{" "}
        <a href="#/mcp-client" className="text-orange-700 hover:underline">
          MCP client
        </a>{" "}
        shows the requirements as a table.
      </>
    }
  />
)
