import { Agent, callable, routeAgentRequest } from "agents"
import { browserLinks, browserMarkdown, browserScreenshot } from "agents/browser"
import { createQuickActionTools } from "agents/browser/ai"
import { generateText, isStepCount } from "ai"
import { createWorkersAI } from "workers-ai-provider"
import type { AskResult, BrowserAction, BrowserState } from "./types.ts"

const model = "@cf/zai-org/glm-4.7-flash"

const toBase64 = (bytes: Uint8Array): string => {
  let binary = ""
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}
const logLimit = 20

export class BrowserAgent extends Agent<Env, BrowserState> {
  override initialState: BrowserState = { log: [] }

  @callable()
  markdown(url: string): Promise<string> {
    return this.logged("markdown", url, () => browserMarkdown(this.env.BROWSER, { url }))
  }

  @callable()
  links(url: string): Promise<string[]> {
    return this.logged("links", url, () => browserLinks(this.env.BROWSER, { url }))
  }

  @callable()
  screenshot(url: string): Promise<string> {
    return this.logged("screenshot", url, async () => {
      const shot = await browserScreenshot(this.env.BROWSER, { url })
      return `data:${shot.contentType};base64,${toBase64(new Uint8Array(shot.data))}`
    })
  }

  @callable()
  ask(url: string, question: string): Promise<AskResult> {
    return this.logged("ask", url, async () => {
      const result = await generateText({
        model: createWorkersAI({ binding: this.env.AI })(model),
        instructions:
          "Read the page with the browser_* tools, then answer in two or three sentences based only on what they return.",
        prompt: `Page: ${url}\n\nQuestion: ${question}`,
        tools: createQuickActionTools({ browser: this.env.BROWSER }),
        stopWhen: isStepCount(4),
      })
      const toolsUsed = result.steps.flatMap((step) => step.toolCalls.map((call) => call.toolName))
      return { answer: result.text, toolsUsed: [...new Set(toolsUsed)] }
    })
  }

  private async logged<T>(action: BrowserAction, url: string, run: () => Promise<T>): Promise<T> {
    const started = Date.now()
    const record = (ok: boolean) =>
      this.setState({
        log: [
          { action, url, ok, ms: Date.now() - started, at: new Date().toISOString() },
          ...this.state.log,
        ].slice(0, logLimit),
      })
    try {
      const result = await run()
      record(true)
      return result
    } catch (error) {
      record(false)
      throw error
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (await routeAgentRequest(request, env)) ?? new Response("Not found", { status: 404 })
  },
} satisfies ExportedHandler<Env>
