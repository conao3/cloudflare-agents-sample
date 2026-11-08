# capnweb

`useAgent` can carry its connection on two wires, chosen with `transport`:

| Transport                  | Wire                                                           | `agent.stub` / `agent.call()`                                                               |
| -------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `"cf-websocket"` (default) | Hibernating WebSocket with JSON `rpc` frames                   | Results must be JSON                                                                        |
| `"capnweb"` (experimental) | One [Cap'n Web](https://github.com/cloudflare/capnweb) session | Methods are invoked natively; an `RpcTarget` result arrives as a live stub you keep calling |

`CapnwebRoom` is a plain `DurableObject` with the `WebSockets` capability from `agents/websockets`, which speaks the Agent protocol on both wires, so `useAgent` works against it. Its `callables` is an `RpcTarget` with `ping`, `say`, and `tally(name)`. `tally` returns a `TallyHandle`, itself an `RpcTarget`: over capnweb the page gets a stub and calls `increment` on it; over cf-websocket the same call fails because an `RpcTarget` cannot be put in a JSON frame.

A capnweb connection keeps the Durable Object in memory while it is open (no hibernation). Try it from the dashboard at `#/capnweb`, where both transports connect to the same room side by side.
