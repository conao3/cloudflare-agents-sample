export const transports = ["cf-websocket", "capnweb"] as const

export type Transport = (typeof transports)[number]
