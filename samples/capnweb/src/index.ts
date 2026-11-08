import { DurableObject, RpcTarget } from "cloudflare:workers"
import { routeAgentRequest } from "agents"
import { Lifecycle } from "agents/lifecycle"
import { isCapnWebTransportUpgrade, WebSockets } from "agents/websockets"
import type { Transport } from "./types.ts"

type MemberState = { transport: Transport; joinedAt: string }

type Member = MemberState & { id: string }

type Frame =
  | { type: "joined"; member: Member; members: number }
  | { type: "left"; id: string; members: number }
  | { type: "said"; from: Transport; text: string; at: string }
  | { type: "tally"; name: string; value: number }

class TallyHandle extends RpcTarget {
  readonly #room: CapnwebRoom
  readonly #name: string

  constructor(room: CapnwebRoom, name: string) {
    super()
    this.#room = room
    this.#name = name
  }

  increment(by: number): number {
    return this.#room.addToTally(this.#name, by)
  }

  value(): number {
    return this.#room.tallyValue(this.#name)
  }
}

class RoomCallables extends RpcTarget {
  readonly #room: CapnwebRoom

  constructor(room: CapnwebRoom) {
    super()
    this.#room = room
  }

  ping(): { at: string; members: Member[] } {
    return { at: new Date().toISOString(), members: this.#room.members() }
  }

  say(from: Transport, text: string): number {
    const members = this.#room.members().length
    this.#room.broadcast({ type: "said", from, text, at: new Date().toISOString() })
    return members
  }

  tally(name: string): TallyHandle {
    return new TallyHandle(this.#room, name.trim() === "" ? "default" : name.trim())
  }
}

export class CapnwebRoom extends DurableObject<Env> {
  readonly webSockets = new WebSockets({
    handlers: {
      onConnect: (connection, { request }) => {
        const state: MemberState = {
          transport: isCapnWebTransportUpgrade(request) ? "capnweb" : "cf-websocket",
          joinedAt: new Date().toISOString(),
        }
        connection.setState(state)
        const member: Member = { id: connection.id, ...state }
        this.broadcast({ type: "joined", member, members: this.members().length })
      },
      onClose: (connection) => {
        this.broadcast({ type: "left", id: connection.id, members: this.members().length })
      },
    },
    callables: new RoomCallables(this),
  })

  readonly lifecycle = Lifecycle.install(this).use(this.webSockets)

  members(): Member[] {
    return [...this.webSockets.getConnections<MemberState>()].map((connection) => ({
      id: connection.id,
      transport: connection.state?.transport ?? "cf-websocket",
      joinedAt: connection.state?.joinedAt ?? "",
    }))
  }

  tallyValue(name: string): number {
    return this.ctx.storage.kv.get<number>(`tally:${name}`) ?? 0
  }

  addToTally(name: string, by: number): number {
    const value = this.tallyValue(name) + by
    this.ctx.storage.kv.put(`tally:${name}`, value)
    this.broadcast({ type: "tally", name, value })
    return value
  }

  broadcast(frame: Frame) {
    const message = JSON.stringify(frame)
    for (const connection of this.webSockets.getConnections()) {
      connection.send(message)
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (await routeAgentRequest(request, env)) ?? new Response("Not found", { status: 404 })
  },
} satisfies ExportedHandler<Env>
