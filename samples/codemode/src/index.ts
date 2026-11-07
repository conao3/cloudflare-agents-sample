import { AIChatAgent, type OnChatMessageOptions } from "@cloudflare/ai-chat"
import { DynamicWorkerExecutor } from "@cloudflare/codemode"
import { createCodeTool } from "@cloudflare/codemode/ai"
import { callable, routeAgentRequest } from "agents"
import { convertToModelMessages, isStepCount, streamText, tool } from "ai"
import { createWorkersAI } from "workers-ai-provider"
import * as z from "zod"

const model = "@cf/zai-org/glm-4.7-flash"

type Todo = { id: number; title: string; done: number; tag: string }

export class CodemodeAgent extends AIChatAgent<Env> {
  override maxPersistedMessages = 60

  override onStart() {
    void this.sql`create table if not exists todos (
      id integer primary key autoincrement,
      title text not null,
      done integer not null default 0,
      tag text not null default ''
    )`
  }

  @callable()
  todos(): Todo[] {
    return this.sql<Todo>`select id, title, done, tag from todos order by id`
  }

  override async onChatMessage(_onFinish: unknown, options?: OnChatMessageOptions) {
    const tools = {
      addTodo: tool({
        description: "Add a todo and return its id",
        inputSchema: z.object({ title: z.string(), tag: z.string().default("") }),
        execute: async ({ title, tag }) => {
          const [row] = this.sql<{
            id: number
          }>`insert into todos (title, tag) values (${title}, ${tag}) returning id`
          return { id: row?.id }
        },
      }),
      listTodos: tool({
        description: "List all todos",
        inputSchema: z.object({}),
        execute: async () => this.todos(),
      }),
      setDone: tool({
        description: "Mark a todo as done or not done",
        inputSchema: z.object({ id: z.number().int(), done: z.boolean() }),
        execute: async ({ id, done }) => {
          void this.sql`update todos set done = ${done ? 1 : 0} where id = ${id}`
          return { id, done }
        },
      }),
    }
    const codemode = createCodeTool({
      tools,
      executor: new DynamicWorkerExecutor({ loader: this.env.LOADER }),
    })
    const result = streamText({
      abortSignal: options?.abortSignal,
      model: createWorkersAI({ binding: this.env.AI })(model),
      instructions:
        "You manage a todo list. To read or change todos, call the codemode tool with JavaScript that calls the functions on the `codemode` object. Batch several operations in one program. Answer in the user's language.",
      messages: await convertToModelMessages(this.messages),
      tools: { codemode },
      stopWhen: isStepCount(6),
    })
    return result.toUIMessageStreamResponse()
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (await routeAgentRequest(request, env)) ?? new Response("Not found", { status: 404 })
  },
} satisfies ExportedHandler<Env>
