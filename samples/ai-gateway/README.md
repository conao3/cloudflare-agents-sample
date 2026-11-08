# ai-gateway

`AiGatewayAgent` calls Workers AI with `env.AI.run(model, input, { gateway: { id: "default", cacheTtl, skipCache, metadata } })`. The `default` gateway is created on first use. After each call, `env.AI.aiGatewayLogId` identifies the request, and `env.AI.gateway("default").getLog(id)` returns what the gateway recorded: cache hit or miss, latency, tokens, and the provider and model.

Ask the same question again: once the first answer is stored (a few seconds in production), the next one comes from the gateway cache in about 100 ms. Try it from the dashboard at `#/ai-gateway`.
