# dynamic-tools

`DynamicToolsAgent` defines no tools of its own. The page passes tools to `useAgentChat({ tools })`: a description, a JSON Schema, and an `execute` that runs in the browser. Their schemas travel with each message, and the agent turns them into AI SDK tools with `createToolsFromClientSchemas(options.clientTools)`. When the model calls one, the browser runs it in `onToolCall` and returns the output.

This is the shape for an SDK or platform where the embedding application decides the tools. Try it from the dashboard at `#/dynamic-tools`: add and remove tools between messages and see which ones the model can call.
