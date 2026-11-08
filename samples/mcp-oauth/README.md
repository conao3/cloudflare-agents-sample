# mcp-oauth

A stateless MCP server (`createMcpHandler`) behind `OAuthProvider` from `@cloudflare/workers-oauth-provider`. The provider serves dynamic client registration (`/oauth-mcp/register`), the token endpoint (`/oauth-mcp/token`), and the discovery documents (`/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource/oauth-mcp/mcp`). Requests to `/oauth-mcp/mcp` without a valid token get 401 with a `WWW-Authenticate` challenge.

`/oauth-mcp/authorize` shows a consent page for a single demo user with Approve and Deny (`beginConsent`, `approveConsent`, `denyConsent`). After approval the user's props travel with the token, and the tools `whoami` and `greet` read them with `getMcpAuthContext()`.

Tokens are bound to `<origin>/oauth-mcp/mcp`, taken from the request origin, so the same code works on `localhost` and on the deployed dashboard. Grants and tokens are stored in the `OAUTH_KV` namespace.

Connect from Claude Code with `claude mcp add --transport http cfas-oauth <origin>/oauth-mcp/mcp`, or authorize from the dashboard's MCP client at `#/mcp-client`.
