# queue-fiber

`QueueFiberAgent` runs background work that survives the Durable Object leaving memory.

## Task queue

`enqueue` calls `this.queue("runJob", { jobId }, { id: jobId })` once per job. Each item is a row in SQLite before `queue()` resolves; the alarm loop runs the items one at a time in order and calls `runJob(payload, item)`. Each job waits about 2 s and records its status and attempt count in state. A job set to fail throws, and the queue retries it with backoff (default `{ maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 3000 }`). After the last attempt the item is dropped and `onError` marks the job failed. `dequeue(id)` and `dequeueAll()` remove pending items, and `getQueue(id)` tells the page which jobs are still in the queue.

## Durable fiber

`startCount` runs a 20-step counter (3 s per step) with `startFiber`, which is `runFiber` plus a retained record that `listFibers` and `cancelFiber` read. After each step the fiber calls `ctx.stash({ countId, step, total, stashedAt })`, a synchronous SQLite write. `cancelFiber` marks the record aborted and aborts `ctx.signal`, which ends the loop. `static options = { keepAliveIntervalMs: 2000 }` makes the keep-alive heartbeat, and so the recovery alarm, fire every 2 s.

When the process dies mid-job, the fiber record is left behind. On the next start the persisted alarm (or the first connection) finds it, marks it `interrupted`, and calls `onFiberRecovered({ id, name, snapshot, ... })`. The hook starts a new fiber from `snapshot.step`, so the count continues from the last checkpoint instead of from 0.

To try it, start counting at `#/queue-fiber`, stop `pnpm dev` with Ctrl-C after a few steps, and start it again with the same `.wrangler/state`. Within a few seconds of `Ready on`, without opening the page, the count resumes from the checkpoint; the page then shows the recovery and both fiber records (`interrupted` and the new `running` one). Stop the whole process tree: `wrangler dev` with several configs runs one `workerd` per Worker, and killing only the `wrangler` process leaves this Worker's `workerd` running, so the fiber never stops.
