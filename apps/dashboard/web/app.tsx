import { samples, type Sample } from "../src/samples.ts"
import { SchedulerPage } from "./pages/scheduler.tsx"
import { StateCounterPage } from "./pages/state-counter.tsx"
import { useRoute } from "./route.ts"

const pages: Record<string, () => React.JSX.Element> = {
  "state-counter": StateCounterPage,
  scheduler: SchedulerPage,
}

const SampleCard = ({ sample }: { sample: Sample }) => {
  const ready = sample.status === "ready"
  const body = (
    <>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="font-semibold text-zinc-900">{sample.title}</h2>
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${ready ? "bg-orange-100 text-orange-800" : "bg-zinc-100 text-zinc-500"}`}
        >
          {ready ? "Ready" : "Planned"}
        </span>
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
  return ready ? (
    <a
      href={`#/${sample.id}`}
      className="block rounded-lg border border-zinc-200 bg-white p-4 hover:border-orange-400 hover:shadow-sm"
    >
      {body}
    </a>
  ) : (
    <div
      title="This sample is not implemented yet"
      className="cursor-not-allowed rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 opacity-70"
    >
      {body}
    </div>
  )
}

const Home = () => (
  <div className="grid gap-3 sm:grid-cols-2">
    {samples.map((sample) => (
      <SampleCard key={sample.id} sample={sample} />
    ))}
  </div>
)

export const App = () => {
  const route = useRoute()
  const sample = samples.find((s) => s.id === route)
  const Page = pages[route]
  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
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
      <main className="mx-auto max-w-5xl px-4 py-6">
        {Page === undefined ? (
          <Home />
        ) : (
          <>
            <p className="mb-4 text-sm text-zinc-600">{sample?.summary}</p>
            <Page />
          </>
        )}
      </main>
    </div>
  )
}
