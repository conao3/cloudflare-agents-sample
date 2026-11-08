import { useState } from "react"
import { Button, Card } from "../ui.tsx"
import { McpTester } from "./mcp-server.tsx"

const metadataPaths = [
  "/.well-known/oauth-protected-resource/oauth-mcp/mcp",
  "/.well-known/oauth-authorization-server",
] as const

const Metadata = () => {
  const [output, setOutput] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setBusy(true)
    try {
      const docs = await Promise.all(
        metadataPaths.map(async (path) => {
          const response = await fetch(path)
          const body: unknown = await response.json()
          return `GET ${path} (${response.status})\n${JSON.stringify(body, null, 2)}`
        }),
      )
      setOutput(docs.join("\n\n"))
    } catch (e) {
      setOutput(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="OAuth discovery">
      <p className="mb-3 text-sm text-zinc-700">
        A client that gets 401 from the endpoint reads the protected resource metadata named in{" "}
        <code>WWW-Authenticate</code>, then the authorization server metadata, registers itself at{" "}
        <code>/oauth-mcp/register</code>, and sends the user to <code>/oauth-mcp/authorize</code>.
        The consent page signs in a single demo user.
      </p>
      <Button tone="secondary" onClick={() => void load()} disabled={busy} disabledReason="Loading">
        Fetch metadata
      </Button>
      {output !== null && (
        <pre className="mt-3 max-h-96 overflow-auto rounded bg-zinc-900 p-3 text-xs text-zinc-100">
          {output}
        </pre>
      )}
    </Card>
  )
}

export const McpOauthPage = () => (
  <div className="flex flex-col gap-4">
    <McpTester
      endpoint="/oauth-mcp/mcp"
      serverName="cfas-oauth"
      defaultTools={["whoami", "greet"]}
      defaultArgs="{}"
      note={
        <>
          Claude Code opens the consent page in your browser when you connect. The browser tester on
          the right sends no token, so it gets 401 with the <code>WWW-Authenticate</code> challenge.
          To go through the whole flow here, open the{" "}
          <a href="#/mcp-client" className="text-orange-700 hover:underline">
            MCP client
          </a>
          , add this server with its quick-add button, and press Authorize.
        </>
      }
    />
    <Metadata />
  </div>
)
