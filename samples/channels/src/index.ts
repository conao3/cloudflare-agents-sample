import { DurableObject } from "cloudflare:workers"
import {
  ChannelGateway,
  Channels,
  type GatewayEvent,
  type GatewayOrigin,
} from "agents/experimental/channels"
import { web, WebChannel } from "agents/experimental/channels/web"
import { AiSdkHarness } from "agents/harness/ai-sdk"
import { Lifecycle } from "agents/lifecycle"
import { tool } from "ai"
import { createWorkersAI } from "workers-ai-provider"
import * as z from "zod"
import { channelsModel } from "./types.ts"

const system = [
  "You are the assistant in a shared chat room of a Cloudflare Agents demo.",
  'Several people write here; each message starts with the sender\'s name, as in "Alice: hi".',
  "Address people by name and keep answers short.",
  "Use getLocalTime when someone asks for their time; it runs in that person's browser.",
  "Answer in the language of the message.",
].join(" ")

const tools = {
  getLocalTime: tool({
    description: "Get the local time and timezone of the person who sent the message",
    inputSchema: z.object({}),
  }),
}

const roomPath = /^\/channels\/([^/]+)$/

const room = (request: Request): string | undefined => {
  const match = roomPath.exec(new URL(request.url).pathname)
  return match === null ? undefined : decodeURIComponent(match[1] ?? "")
}

export class ChannelsAgent extends DurableObject<Env> {
  readonly harness = new AiSdkHarness({
    model: createWorkersAI({ binding: this.env.AI })(channelsModel),
    system,
    tools,
  })
  readonly channels = Channels.forHarness(this.harness, { channels: { web: new WebChannel() } })
  readonly lifecycle = Lifecycle.install(this)
    .use(this.harness)
    .use(this.channels.streams)
    .use(this.channels)
    .use(this.channels.websockets)

  receive(event: GatewayEvent, origin: GatewayOrigin) {
    return this.channels.receive(event, origin)
  }
}

const gateway = (env: Env) =>
  new ChannelGateway({
    agent: (route) => env.ChannelsAgent.getByName(route),
    channels: {
      web: web({
        match: (request) => (room(request) === undefined ? undefined : {}),
        participant: (request) => {
          const name = new URL(request.url).searchParams.get("as")?.trim() ?? ""
          return name === "" ? null : { id: name, name }
        },
        route: (request) => room(request) ?? null,
      }),
    },
  })

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (await gateway(env).fetch(request)) ?? new Response("Not found", { status: 404 })
  },
} satisfies ExportedHandler<Env>
