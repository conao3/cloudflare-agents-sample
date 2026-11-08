export type Visit = { origin: string; via: "websocket" | "http"; at: string }

export type CrossDomainState = { visits: Visit[] }
