# scheduler

A `SchedulerAgent` that schedules calls to its own `fire()` method.

- `this.schedule(seconds, ...)`: run once after a delay.
- `this.schedule(date, ...)`: run once at a date.
- `this.schedule("* * * * *", ...)`: run on a cron expression (UTC).
- `this.scheduleEvery(seconds, ...)`: run at a fixed interval.
- `this.listSchedules()` and `this.cancelSchedule(id)`: list and cancel pending schedules.

Each run appends to the agent's state, so the dashboard's run list updates live. Schedules live in the agent's SQLite and survive restarts; the agent sleeps between runs and is woken by an alarm.

Try it from the dashboard at `#/scheduler`.
