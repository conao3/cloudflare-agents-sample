import { Think } from "@cloudflare/think"
import { createFetchTools } from "@cloudflare/think/tools/fetch"
import { callable, routeAgentRequest } from "agents"
import { agentTool } from "agents/agent-tools"
import type { ToolSet } from "ai"
import * as z from "zod"
import { helperClasses } from "./types.ts"

const model = "@cf/zai-org/glm-4.7-flash" as const

const inputText = (input: unknown): string => {
  if (typeof input === "string") return input
  const parsed = z
    .object({ query: z.string() })
    .or(z.object({ goal: z.string() }))
    .safeParse(input)
  if (!parsed.success) return JSON.stringify(input)
  return "query" in parsed.data ? parsed.data.query : parsed.data.goal
}

class Helper extends Think<Env> {
  override getModel() {
    return model
  }

  override formatAgentToolInput(input: unknown) {
    return {
      id: crypto.randomUUID(),
      role: "user" as const,
      parts: [{ type: "text" as const, text: inputText(input) }],
    }
  }
}

export class Researcher extends Helper {
  override getSystemPrompt() {
    return [
      "You are a research helper. Fetch one or two relevant pages with the fetch tool,",
      "then answer with a short summary and the URLs you read.",
      "Allowed hosts: developers.cloudflare.com, en.wikipedia.org, github.com, raw.githubusercontent.com.",
    ].join(" ")
  }

  override getTools(): ToolSet {
    return createFetchTools({
      allowlist: [
        "https://developers.cloudflare.com/**",
        "https://en.wikipedia.org/**",
        "https://github.com/**",
        "https://raw.githubusercontent.com/**",
      ],
      maxModelChars: 8000,
    })
  }
}

export class Planner extends Helper {
  override getSystemPrompt() {
    return "You are a planning helper. Turn the goal into a numbered plan of 3 to 6 concrete steps, each one line."
  }
}

export class SubAgentsAgent extends Think<Env> {
  override maxConcurrentAgentTools = 3

  override getModel() {
    return model
  }

  override getSystemPrompt() {
    return [
      "You coordinate helper agents in a demo of Cloudflare Agents.",
      "Use `research` to look something up on the web and `plan` to break a goal into steps.",
      "You can call both in the same turn. After they return, answer briefly from their results.",
      "Answer in the user's language.",
    ].join(" ")
  }

  override getTools(): ToolSet {
    return {
      research: agentTool(Researcher, {
        description: "Ask the Researcher agent to look something up on the web",
        displayName: "Researcher",
        inputSchema: z.object({ query: z.string().min(3) }),
      }),
      plan: agentTool(Planner, {
        description: "Ask the Planner agent to break a goal into steps",
        displayName: "Planner",
        inputSchema: z.object({ goal: z.string().min(3) }),
      }),
    }
  }

  override async onBeforeSubAgent(_request: Request, child: { className: string; name: string }) {
    if (
      !helperClasses.some((c) => c === child.className) ||
      !this.hasAgentToolRun(child.className, child.name)
    ) {
      return new Response("Not found", { status: 404 })
    }
    return undefined
  }

  @callable()
  async clearRuns() {
    await this.clearAgentToolRuns()
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (await routeAgentRequest(request, env)) ?? new Response("Not found", { status: 404 })
  },
} satisfies ExportedHandler<Env>
