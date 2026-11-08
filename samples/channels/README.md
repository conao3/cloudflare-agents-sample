# channels

Experimental: `agents/experimental/channels` and `agents/harness/ai-sdk` may change between releases.

A harness-backed agent served to several people through a Channel. `ChannelsAgent` is a plain `DurableObject`:

1. `AiSdkHarness` keeps the conversation's transcript and runs each message with `streamText` on Workers AI, one at a time, queueing the rest.
2. `Channels.forHarness(harness, { channels: { web: new WebChannel() } })` serves the harness session as a conversation over WebSockets.
3. `Lifecycle.install(this).use(...)` wires the harness, streams, channels, and WebSockets into the object's lifecycle.

The Worker's `ChannelGateway` takes WebSocket upgrades at `/channels/<room>`, names the participant from `?as=<name>` (demo only: a real app resolves the participant from a session it can verify), and routes everyone in a room to the same agent object. The browser connects with `WebChannelClient` from `agents/experimental/channels/web/client` and sends `message` events; every participant sees the same transcript and turns. The protocol carries no sender on a user message, so the page writes the name at the start of the text, which also tells the model who is speaking.

`getLocalTime` has no `execute`: the harness marks the call with the `owner` participant who asked, and only that person's browser answers it with a `tool-result` event.

Try it from the dashboard at `#/channels`: open two tabs, join the same room under two names, and chat.

Slack and Telegram follow the same pattern: `slack({ botToken, webhook, participant })` from `agents/experimental/channels/slack` and `telegram(...)` from `agents/experimental/channels/telegram` are Channels next to `web`, fed by signed webhooks. They need a bot account and its tokens, so they are not built here.
