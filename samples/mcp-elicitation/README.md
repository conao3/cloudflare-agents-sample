# mcp-elicitation

A stateless MCP server at `/elicit/mcp` that asks the user for input with multi-round-trip requests (MRTR). `order_coffee` answers its first call with `inputRequired`: a form for the name, size, number of cups, and oat milk, plus a signed `requestState`. The client retries the call with the answers (`inputResponse`, `acceptedContent`), gets a confirmation question with a new `requestState`, and retries once more to get the final result. No request waits on another and nothing is stored between them.

`createMcpHandler(..., { legacy: "reject" })` accepts only stateless clients. `requestState` is signed with `MRTR_REQUEST_STATE_KEY` (`createRequestStateCodec`), a secret of at least 32 bytes:

```sh
printf 'MRTR_REQUEST_STATE_KEY=%s\n' "$(head -c 48 /dev/urandom | base64 -w0)" > .dev.vars
```

Try it from the dashboard's MCP client at `#/mcp-client`, which shows each question as a form.
