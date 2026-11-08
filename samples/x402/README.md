# x402

A stateless MCP server at `/x402/mcp` with a paid tool. `withX402` from `agents/x402` adds `paidTool` to the `McpServer`; `premium_fortune` costs USD 0.01 in USDC on Base Sepolia (`eip155:84532`), settled through the public facilitator `https://x402.org/facilitator`. `free_fortune` is an ordinary tool.

A call without a payment returns a tool result with `isError` and `_meta["x402/error"]`: `PAYMENT_REQUIRED` and the payment requirements (amount in atomic units, asset contract, network, `payTo`). A client with a funded testnet wallet (`withX402Client`) signs the payment, sends it in `_meta["x402/payment"]`, and gets the result. The sample stops at the requirements, so it needs no wallet, key, or funds.

The recipient address is the `X402_RECIPIENT` var, a placeholder. Try it from the dashboard's MCP client at `#/mcp-client`, which shows the requirements as a table.
