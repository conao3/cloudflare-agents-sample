import {
  failureModes,
  maxAttempts,
  type FailureMode,
  type Job,
  type QueueFiberState,
} from "@cfas/queue-fiber/types"
import { useAgent } from "agents/react"
import { useCallback, useEffect, useState } from "react"
import * as z from "zod"
import { Button, Card, ConnectionBadge, Field, formatTime, inputClass } from "../ui.tsx"

const failureLabels: Record<FailureMode, string> = {
  none: "Succeed",
  first: "Fail the first attempt",
  always: "Fail every attempt",
}

const jobStatusClass: Record<Job["status"], string> = {
  pending: "bg-zinc-100 text-zinc-700",
  running: "bg-blue-100 text-blue-800",
  retrying: "bg-amber-100 text-amber-800",
  done: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  removed: "bg-zinc-200 text-zinc-600",
}

const fiberSchema = z.object({
  fiberId: z.string(),
  status: z.string(),
  snapshot: z.string(),
  error: z.string().nullable(),
  createdAt: z.number(),
  settledAt: z.number().nullable(),
})

type Fiber = z.infer<typeof fiberSchema>

const fiberStatusClass = (status: string): string =>
  status === "running"
    ? "bg-blue-100 text-blue-800"
    : status === "completed"
      ? "bg-green-100 text-green-800"
      : status === "interrupted"
        ? "bg-amber-100 text-amber-800"
        : "bg-zinc-200 text-zinc-700"

const short = (id: string) => id.slice(0, 8)

export const QueueFiberPage = () => {
  const agent = useAgent<QueueFiberState>({ agent: "queue-fiber-agent", name: "default" })
  const connected = agent.identified
  const jobs = agent.state?.jobs ?? []
  const count = agent.state?.count ?? null
  const recoveries = agent.state?.recoveries ?? []
  const [jobCount, setJobCount] = useState("3")
  const [failure, setFailure] = useState<FailureMode>("none")
  const [queued, setQueued] = useState<string[]>([])
  const [fibers, setFibers] = useState<Fiber[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const [ids, list] = await Promise.all([agent.call("queued", []), agent.call("fibers", [])])
    setQueued(z.array(z.string()).parse(ids))
    setFibers(z.array(fiberSchema).parse(list))
  }, [agent])

  const stateKey = agent.state === undefined ? "" : JSON.stringify(agent.state)
  useEffect(() => {
    if (connected) void refresh()
  }, [connected, stateKey, refresh])

  const act = async (key: string, run: () => Promise<string>) => {
    setBusy(key)
    setError(null)
    setNotice(null)
    try {
      setNotice(await run())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  const n = Number(jobCount)
  const enqueueReason = !connected
    ? "Waiting for the WebSocket connection"
    : busy !== null
      ? "Running"
      : !(Number.isInteger(n) && n >= 1 && n <= 10)
        ? "Enter a whole number from 1 to 10"
        : undefined
  const tally = (status: Job["status"]) => jobs.filter((j) => j.status === status).length
  const pending = tally("pending")
  const finished = tally("done") + tally("failed")
  const running = count?.status === "running"
  const percent = count === null ? 0 : Math.round((count.step / count.total) * 100)

  return (
    <div className="flex flex-col gap-4">
      {(notice !== null || error !== null) && (
        <div
          className={`rounded-md px-3 py-2 text-sm ${error !== null ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"}`}
        >
          {error ?? notice}
        </div>
      )}
      <Card title="Task queue">
        <div className="mb-3">
          <ConnectionBadge connected={connected} />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Jobs">
            <input
              className={`${inputClass} w-20`}
              type="number"
              min={1}
              max={10}
              value={jobCount}
              onChange={(e) => setJobCount(e.target.value)}
            />
          </Field>
          <Field label="Each job">
            <select
              className={inputClass}
              value={failure}
              onChange={(e) => setFailure(z.enum(failureModes).parse(e.target.value))}
            >
              {failureModes.map((mode) => (
                <option key={mode} value={mode}>
                  {failureLabels[mode]}
                </option>
              ))}
            </select>
          </Field>
          <Button
            onClick={() =>
              void act("enqueue", async () => {
                const ids = z.array(z.string()).parse(await agent.call("enqueue", [n, failure]))
                return `Queued ${ids.length} job${ids.length === 1 ? "" : "s"}`
              })
            }
            disabled={enqueueReason !== undefined}
            disabledReason={enqueueReason}
          >
            Enqueue
          </Button>
          <Button
            tone="secondary"
            onClick={() =>
              void act("removeAll", async () => {
                const removed = z.number().parse(await agent.call("removeAll", []))
                return `dequeueAll removed ${removed} item${removed === 1 ? "" : "s"}`
              })
            }
            disabled={pending === 0 || busy !== null}
            disabledReason={busy !== null ? "Running" : "No pending jobs"}
          >
            Remove all pending
          </Button>
          <Button
            tone="secondary"
            onClick={() =>
              void act("clearJobs", async () => {
                await agent.call("clearJobs", [])
                return `Cleared ${finished} finished job${finished === 1 ? "" : "s"}`
              })
            }
            disabled={finished === 0 || busy !== null}
            disabledReason={busy !== null ? "Running" : "No finished jobs"}
          >
            Clear finished
          </Button>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          <code>this.queue("runJob", payload)</code> writes each job to SQLite and returns at once.
          The alarm loop runs them one at a time in order; each takes about 2 s. A job that throws
          is retried with backoff (default {maxAttempts} attempts); after the last failure it is
          dropped and <code>onError</code> marks it failed.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {(["pending", "running", "retrying", "done", "failed", "removed"] as const).map((s) => (
            <span key={s} className={`rounded-full px-2 py-0.5 ${jobStatusClass[s]}`}>
              {s} {tally(s)}
            </span>
          ))}
          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-orange-800">
            in SQLite queue {queued.length}
          </span>
        </div>
        {jobs.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No jobs yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {jobs.map((job) => (
              <li
                key={job.id}
                className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm"
              >
                <span className="font-medium text-zinc-900">{job.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${jobStatusClass[job.status]}`}>
                  {job.status}
                </span>
                {queued.includes(job.id) && (
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-800">
                    queued
                  </span>
                )}
                <span className="text-xs text-zinc-500">{failureLabels[job.failure]}</span>
                <span className="text-xs text-zinc-500">
                  attempt {job.attempts}/{maxAttempts}
                </span>
                {job.error !== null && <span className="text-xs text-red-700">{job.error}</span>}
                <span className="ml-auto text-xs text-zinc-500">{formatTime(job.updatedAt)}</span>
                {job.status === "pending" && (
                  <Button
                    tone="secondary"
                    onClick={() =>
                      void act(job.id, async () => {
                        const removed = z.boolean().parse(await agent.call("remove", [job.id]))
                        return removed
                          ? `dequeue removed ${job.label}`
                          : `${job.label} had already left the queue`
                      })
                    }
                    disabled={busy !== null}
                    disabledReason="Running"
                  >
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Durable fiber">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() =>
              void act("startCount", async () => {
                const id = z.string().parse(await agent.call("startCount", []))
                return `Started fiber ${short(id)}`
              })
            }
            disabled={!connected || busy !== null || running}
            disabledReason={
              !connected
                ? "Waiting for the WebSocket connection"
                : running
                  ? "A counting job is running"
                  : "Running"
            }
          >
            Start counting (20 × 3 s)
          </Button>
          <Button
            tone="danger"
            onClick={() =>
              void act("cancelCount", async () => {
                const cancelled = z.boolean().parse(await agent.call("cancelCount", []))
                return cancelled ? "cancelFiber aborted the fiber" : "The fiber had already settled"
              })
            }
            disabled={!running || busy !== null}
            disabledReason={busy !== null ? "Running" : "No counting job is running"}
          >
            Cancel
          </Button>
          <Button
            tone="secondary"
            onClick={() =>
              void act("clearCount", async () => {
                const deleted = z.number().parse(await agent.call("clearCount", []))
                return `deleteFibers removed ${deleted} settled fiber record${deleted === 1 ? "" : "s"}`
              })
            }
            disabled={running || busy !== null || (count === null && fibers.length === 0)}
            disabledReason={
              running
                ? "Cancel the running job first"
                : busy !== null
                  ? "Running"
                  : "Nothing to clear"
            }
          >
            Clear
          </Button>
        </div>
        {count === null ? (
          <p className="mt-3 text-sm text-zinc-500">No counting job yet.</p>
        ) : (
          <div className="mt-3 rounded-md border border-zinc-200 p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium text-zinc-900">
                Step {count.step} / {count.total}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${count.status === "running" ? "bg-blue-100 text-blue-800" : count.status === "completed" ? "bg-green-100 text-green-800" : "bg-zinc-200 text-zinc-700"}`}
              >
                {count.status}
              </span>
              <span className="text-xs text-zinc-500">fiber {short(count.fiberId)}</span>
              {count.resumes > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                  resumed {count.resumes}×
                </span>
              )}
              <span className="ml-auto text-xs text-zinc-500">
                started {formatTime(count.startedAt)}
              </span>
            </div>
            <div className="mb-2 h-1.5 overflow-hidden rounded bg-zinc-100">
              <div
                className="h-full bg-orange-500 transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="mb-1 text-xs text-zinc-500">Last checkpoint (ctx.stash)</p>
            <pre className="overflow-x-auto rounded bg-zinc-50 p-2 text-xs text-zinc-600">
              {count.checkpoint === null ? "none yet" : JSON.stringify(count.checkpoint, null, 2)}
            </pre>
          </div>
        )}
        <p className="mt-3 text-xs text-zinc-500">
          The job runs in <code>startFiber</code> (a <code>runFiber</code> with a retained record,
          so <code>listFibers</code> and <code>cancelFiber</code> see it). After each step it calls{" "}
          <code>ctx.stash()</code>, a synchronous SQLite write. To see recovery, stop{" "}
          <code>pnpm dev</code> with Ctrl-C mid-job and start it again: on the next alarm or
          connection the agent finds the orphaned fiber, calls <code>onFiberRecovered</code> with
          the last snapshot, and starts a new fiber from that step.{" "}
          <code>keepAliveIntervalMs: 2000</code> makes the recovery alarm fire within a few seconds.
        </p>
      </Card>
      <Card title={`Recoveries (${recoveries.length})`}>
        {recoveries.length === 0 ? (
          <p className="text-sm text-zinc-500">
            None yet. Restart the dev server while counting to trigger one.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recoveries.map((r) => (
              <li
                key={r.fiberId}
                className="rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span>
                    fiber {short(r.fiberId)} interrupted at step {r.snapshot?.step ?? 0}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {r.resumedAs === null ? "not resumed" : `resumed as ${short(r.resumedAs)}`}
                  </span>
                  <span className="ml-auto text-xs text-zinc-500">{formatTime(r.recoveredAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title={`Fiber records (listFibers, ${fibers.length})`}>
        {fibers.length === 0 ? (
          <p className="text-sm text-zinc-500">No fiber records.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-zinc-500">
              <tr>
                <th className="py-1 font-normal">Fiber</th>
                <th className="py-1 font-normal">Status</th>
                <th className="py-1 font-normal">Snapshot</th>
                <th className="py-1 font-normal">Created</th>
              </tr>
            </thead>
            <tbody>
              {fibers.map((f) => (
                <tr key={f.fiberId} className="border-t border-zinc-100 align-top">
                  <td className="py-1 font-mono text-xs">{short(f.fiberId)}</td>
                  <td className="py-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${fiberStatusClass(f.status)}`}
                    >
                      {f.status}
                    </span>
                    {f.error !== null && (
                      <span className="ml-1 text-xs text-zinc-500">{f.error}</span>
                    )}
                  </td>
                  <td className="max-w-xs truncate py-1 font-mono text-xs text-zinc-600">
                    {f.snapshot}
                  </td>
                  <td className="py-1 text-xs text-zinc-500">
                    {new Date(f.createdAt).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
