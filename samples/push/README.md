# push

`PushAgent` sends Web Push notifications with the `web-push` package (VAPID, `aes128gcm`). The dashboard page registers the service worker `/sw.js`, asks for notification permission, subscribes with the agent's VAPID public key, and calls `subscribe`. The agent keeps subscriptions in `this.sql`, not in state, so endpoints are never broadcast to clients; state only carries counts and the last send result.

`sendTest` pushes to every subscription and returns the push service's HTTP status for each (201 means accepted). `createReminder(message, delaySeconds)` stores a reminder and calls `this.schedule`, so the push arrives from a Durable Object alarm even after the tab is closed; `cancelReminder` cancels the schedule and `listReminders` reads the table. Subscriptions that answer 404 or 410 are deleted. The page names the agent with a random id kept in the browser's local storage, so each browser has its own agent.

Secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (a `mailto:` or `https:` URL). Generate them with

```sh
node samples/push/scripts/generate-vapid-keys.mjs > samples/push/.dev.vars
```

and edit `VAPID_SUBJECT`. For a deploy, put the same values with `wrangler secret put <name> -c samples/push/wrangler.jsonc`. Changing the keys invalidates existing subscriptions. Try it from the dashboard at `#/push`.
