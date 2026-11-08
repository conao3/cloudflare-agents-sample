import type { JSX } from "react"
import { plannedSamples, samples, type Sample } from "../src/samples.ts"
import { BrowserPage } from "./pages/browser.tsx"
import { ChatPage } from "./pages/chat.tsx"
import { CodemodePage } from "./pages/codemode.tsx"
import { EmailPage } from "./pages/email.tsx"
import { InboxPage } from "./pages/inbox.tsx"
import { McpClientPage } from "./pages/mcp-client.tsx"
import { McpElicitationPage } from "./pages/mcp-elicitation.tsx"
import { McpOauthPage } from "./pages/mcp-oauth.tsx"
import { McpServerPage } from "./pages/mcp-server.tsx"
import { RagPage } from "./pages/rag.tsx"
import { ResearchPage } from "./pages/research.tsx"
import { SchedulerPage } from "./pages/scheduler.tsx"
import { StateCounterPage } from "./pages/state-counter.tsx"
import { SubAgentsPage } from "./pages/sub-agents.tsx"
import { ThinkPage } from "./pages/think.tsx"
import { ToolHubPage } from "./pages/tool-hub.tsx"
import { VoicePage } from "./pages/voice.tsx"
import { WorkflowPage } from "./pages/workflow.tsx"
import { X402Page } from "./pages/x402.tsx"
import { useRoute } from "./route.ts"

type SampleId = (typeof samples)[number]["id"]

const pages: Record<SampleId, () => JSX.Element> = {
  "state-counter": StateCounterPage,
  scheduler: SchedulerPage,
  chat: ChatPage,
  "mcp-server": McpServerPage,
  "mcp-client": McpClientPage,
  "mcp-oauth": McpOauthPage,
  "mcp-elicitation": McpElicitationPage,
  x402: X402Page,
  workflow: WorkflowPage,
  browser: BrowserPage,
  email: EmailPage,
  rag: RagPage,
  codemode: CodemodePage,
  think: ThinkPage,
  "sub-agents": SubAgentsPage,
  voice: VoicePage,
  research: ResearchPage,
  inbox: InboxPage,
  "tool-hub": ToolHubPage,
}

type CardData = {
  id: string
  title: string
  summary: string
  blocks: readonly string[]
  cost: string
}

const CardBody = ({ sample, badge }: { sample: CardData; badge: JSX.Element }) => (
  <>
    <div className="mb-1 flex items-center justify-between gap-2">
      <h2 className="font-semibold text-zinc-900">{sample.title}</h2>
      {badge}
    </div>
    <p className="mb-3 text-sm text-zinc-600">{sample.summary}</p>
    <div className="flex flex-wrap items-center gap-1.5">
      {sample.blocks.map((block) => (
        <code key={block} className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-700">
          {block}
        </code>
      ))}
      <span className="ml-auto text-xs text-zinc-500">{sample.cost}</span>
    </div>
  </>
)

const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname)

const unavailable = (sample: Sample): string | undefined => (isLocal ? undefined : sample.localOnly)

const SampleGrid = ({ kind }: { kind: "single" | "combo" }) => (
  <div className="grid gap-3 sm:grid-cols-2">
    {samples
      .filter((sample) => sample.kind === kind)
      .map((sample) =>
        unavailable(sample) !== undefined ? (
          <div
            key={sample.id}
            title={unavailable(sample)}
            className="cursor-not-allowed rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 opacity-70"
          >
            <CardBody
              sample={sample}
              badge={
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                  Local only
                </span>
              }
            />
          </div>
        ) : (
          <a
            key={sample.id}
            href={`#/${sample.id}`}
            className="block rounded-lg border border-zinc-200 bg-white p-4 hover:border-orange-400 hover:shadow-sm"
          >
            <CardBody
              sample={sample}
              badge={
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-800">
                  Open
                </span>
              }
            />
          </a>
        ),
      )}
  </div>
)

const Home = () => (
  <div className="flex flex-col gap-6">
    <section>
      <h2 className="mb-3 text-sm font-semibold text-zinc-500">Single samples</h2>
      <SampleGrid kind="single" />
    </section>
    <section>
      <h2 className="mb-3 text-sm font-semibold text-zinc-500">Combined samples</h2>
      <SampleGrid kind="combo" />
    </section>
    <section>
      <h2 className="mb-3 text-sm font-semibold text-zinc-500">Not built</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {plannedSamples.map((sample) => (
          <div
            key={sample.id}
            title={sample.cost}
            className="cursor-not-allowed rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 opacity-70"
          >
            <CardBody
              sample={sample}
              badge={
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                  Paid only
                </span>
              }
            />
          </div>
        ))}
      </div>
    </section>
  </div>
)

export const App = () => {
  const route = useRoute()
  const sample = samples.find((s) => s.id === route)
  const Page =
    sample === undefined || unavailable(sample) !== undefined ? undefined : pages[sample.id]
  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <a href="#/" className="font-semibold text-zinc-900">
            Cloudflare Agents samples
          </a>
          {sample !== undefined && <span className="text-zinc-400">/</span>}
          {sample !== undefined && <span className="text-zinc-700">{sample.title}</span>}
          <a
            href="https://github.com/conao3/cloudflare-agents-sample"
            className="ml-auto text-sm text-zinc-500 hover:text-zinc-800"
          >
            GitHub
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {sample === undefined || Page === undefined ? (
          <Home />
        ) : (
          <>
            <p className="mb-4 text-sm text-zinc-600">
              {sample.summary}{" "}
              <a
                href={`https://github.com/conao3/cloudflare-agents-sample/tree/master/samples/${sample.id}`}
                className="text-orange-700 hover:underline"
              >
                Source
              </a>
            </p>
            <Page />
          </>
        )}
      </main>
    </div>
  )
}
