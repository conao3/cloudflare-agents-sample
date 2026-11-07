import { Think } from "@cloudflare/think"
import { callable, routeAgentRequest } from "agents"
import type { TaskSummary, WorkspaceFile } from "./types.ts"

const promptPreview = (metadata: Record<string, unknown> | undefined): string =>
  typeof metadata?.prompt === "string" ? metadata.prompt : ""

export class ThinkAgent extends Think<Env> {
  override getModel() {
    return "@cf/zai-org/glm-4.7-flash" as const
  }

  override getSystemPrompt() {
    return [
      "You are an assistant built on the Think harness in a demo of Cloudflare Agents.",
      "You have a persistent workspace filesystem. When the user asks you to write, save, or note something,",
      "create or edit a file in the workspace with your file tools and say which path you used.",
      "Keep answers short and answer in the user's language.",
    ].join(" ")
  }

  @callable()
  async submitTask(prompt: string): Promise<string> {
    const result = await this.submitMessages(
      [{ id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text: prompt }] }],
      { metadata: { prompt: prompt.slice(0, 200) } },
    )
    return result.submissionId
  }

  @callable()
  async taskList(): Promise<TaskSummary[]> {
    const submissions = await this.listSubmissions({ limit: 20 })
    return submissions.map((s) => ({
      submissionId: s.submissionId,
      status: s.status,
      prompt: promptPreview(s.metadata),
      createdAt: s.createdAt,
      completedAt: s.completedAt ?? null,
      error: s.error ?? null,
    }))
  }

  @callable()
  async files(): Promise<WorkspaceFile[]> {
    const entries = await this.workspace.fs.find("/", undefined, { limit: 100 })
    const files = entries.filter((e) => e.type === "file")
    return Promise.all(
      files.map(async (f) => ({
        path: f.path,
        size: (await this.workspace.fs.stat(f.path))?.size ?? 0,
      })),
    )
  }

  @callable()
  async readFile(path: string): Promise<string> {
    return new Response(await this.workspace.fs.readFile(path)).text()
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (await routeAgentRequest(request, env)) ?? new Response("Not found", { status: 404 })
  },
} satisfies ExportedHandler<Env>
