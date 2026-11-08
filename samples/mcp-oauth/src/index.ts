import {
  AuthorizationError,
  getOAuthApi,
  OAuthProvider,
  type OAuthHelpers,
  type OAuthProviderOptions,
} from "@cloudflare/workers-oauth-provider"
import { McpServer } from "@modelcontextprotocol/server"
import { createMcpHandler, getMcpAuthContext } from "agents/mcp/server"
import * as z from "zod"

const route = "/oauth-mcp/mcp"
const authorizePath = "/oauth-mcp/authorize"

const demoUser = { userId: "demo-user", name: "Demo User", email: "demo@example.com" } as const

const text = (value: string) => ({ content: [{ type: "text" as const, text: value }] })

const createServer = () => {
  const server = new McpServer({ name: "cfas-mcp-oauth", version: "1.0.0" })
  server.registerTool(
    "whoami",
    { description: "Return the user who authorized this client", inputSchema: {} },
    async (_args, context) =>
      text(
        JSON.stringify(
          {
            user: getMcpAuthContext()?.props ?? null,
            clientId: context.http?.authInfo?.clientId ?? null,
            scopes: context.http?.authInfo?.scopes ?? [],
          },
          null,
          2,
        ),
      ),
  )
  server.registerTool(
    "greet",
    {
      description: "Greet the authorized user by name",
      inputSchema: { greeting: z.string().default("Hello") },
    },
    async ({ greeting }) => {
      const name = z.object({ name: z.string() }).safeParse(getMcpAuthContext()?.props)
      return text(`${greeting}, ${name.success ? name.data.name : "stranger"}!`)
    },
  )
  return server
}

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  )

const page = (title: string, body: string, headers = new Headers(), status = 200) => {
  headers.set("content-type", "text/html; charset=utf-8")
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><style>body{font-family:system-ui,sans-serif;background:#fafafa;color:#18181b;margin:0;padding:48px 16px}main{max-width:440px;margin:0 auto;background:#fff;border:1px solid #e4e4e7;border-radius:8px;padding:24px}h1{font-size:18px;margin:0 0 12px}dl{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:14px;margin:16px 0}dt{color:#71717a}dd{margin:0;word-break:break-all}.actions{display:flex;gap:8px;margin-top:20px}button{font:inherit;font-size:14px;padding:6px 14px;border-radius:6px;cursor:pointer}.approve{background:#f97316;border:0;color:#fff}.deny{background:#fff;border:1px solid #d4d4d8;color:#27272a}.warn{font-size:13px;color:#92400e;background:#fffbeb;padding:8px;border-radius:6px}</style></head><body><main>${body}</main></body></html>`,
    { status, headers },
  )
}

const consentPage = async (request: Request, helpers: OAuthHelpers) => {
  const authRequest = await helpers.parseAuthRequest(request)
  const consent = await helpers.describeConsent(authRequest)
  const { handle, headers } = await helpers.beginConsent(authRequest)
  return page(
    "Authorize",
    `<h1>Authorize ${escapeHtml(consent.clientName)}</h1>
<p style="font-size:14px">This client wants to call the tools of the cfas OAuth MCP server as the demo user.</p>
<dl><dt>Signed in as</dt><dd>${demoUser.name} (${demoUser.email})</dd><dt>Client</dt><dd>${escapeHtml(consent.clientName)}</dd><dt>Redirects to</dt><dd>${escapeHtml(consent.redirectHost)}</dd><dt>Scopes</dt><dd>${escapeHtml(consent.scope.join(" ") || "none")}</dd></dl>
${consent.redirectIsLoopback ? `<p class="warn">The redirect goes to a local address. Any local program could receive the code.</p>` : ""}
<form method="post" action="${authorizePath}"><input type="hidden" name="handle" value="${escapeHtml(handle)}"><div class="actions"><button class="approve" name="decision" value="approve">Approve</button><button class="deny" name="decision" value="deny">Deny</button></div></form>`,
    headers,
  )
}

const decisionSchema = z.object({ handle: z.string(), decision: z.enum(["approve", "deny"]) })

const decide = async (request: Request, helpers: OAuthHelpers) => {
  const { handle, decision } = decisionSchema.parse(Object.fromEntries(await request.formData()))
  if (decision === "deny") {
    const denied = await helpers.denyConsent(request, handle)
    return new Response(null, { status: 302, headers: denied.headers })
  }
  const approved = await helpers.approveConsent(request, handle)
  const client = await helpers.lookupClient(approved.request.clientId)
  const { redirectTo } = await helpers.completeAuthorization({
    request: approved.request,
    userId: demoUser.userId,
    metadata: { clientName: client?.clientName ?? approved.request.clientId },
    scope: approved.request.scope,
    props: demoUser,
  })
  approved.headers.set("location", redirectTo)
  return new Response(null, { status: 302, headers: approved.headers })
}

const authorize = async (request: Request, helpers: OAuthHelpers) => {
  try {
    return request.method === "POST"
      ? await decide(request, helpers)
      : await consentPage(request, helpers)
  } catch (e) {
    if (e instanceof AuthorizationError && e.redirectTo !== undefined) {
      return Response.redirect(e.redirectTo, 302)
    }
    const message = e instanceof Error ? e.message : String(e)
    return page(
      "Authorization failed",
      `<h1>Authorization failed</h1><p>${escapeHtml(message)}</p>`,
      new Headers(),
      400,
    )
  }
}

const providerOptions = (origin: string): OAuthProviderOptions<Env> => {
  const hostname = new URL(origin).hostname
  const mcpHandler = createMcpHandler(createServer, {
    route,
    allowedHostnames: [hostname],
    allowedOriginHostnames: [hostname],
  })
  const options: OAuthProviderOptions<Env> = {
    authorizeEndpoint: authorizePath,
    tokenEndpoint: "/oauth-mcp/token",
    clientRegistrationEndpoint: "/oauth-mcp/register",
    apiRoute: route,
    apiHandler: { fetch: (request, env, ctx) => mcpHandler(request, env, ctx) },
    defaultHandler: {
      fetch: async (request, env) => {
        const url = new URL(request.url)
        if (url.pathname !== authorizePath) return new Response("Not found", { status: 404 })
        return authorize(request, getOAuthApi(options, env))
      },
    },
    resourceMetadata: { resource: `${origin}${route}`, resource_name: "cfas OAuth MCP server" },
  }
  return options
}

const providers = new Map<string, OAuthProvider<Env>>()

const providerFor = (origin: string) => {
  const existing = providers.get(origin)
  if (existing !== undefined) return existing
  const created = new OAuthProvider(providerOptions(origin))
  providers.set(origin, created)
  return created
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return providerFor(new URL(request.url).origin).fetch(request, env, ctx)
  },
} satisfies ExportedHandler<Env>
