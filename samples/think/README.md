# think

`ThinkAgent` extends `Think` from `@cloudflare/think`, the ready-made agent loop. The class only declares `getModel` (`@cf/zai-org/glm-4.7-flash`) and `getSystemPrompt`; Think supplies chat persistence, recovery after eviction, and a workspace filesystem with file tools (`write`, `read`, `edit`, `find`) the model uses on its own.

- `submitMessages` queues a turn that runs in the background even after the browser disconnects; `listSubmissions` shows its status.
- `this.workspace.fs` reads the files the model wrote.

Try it from the dashboard at `#/think`.
