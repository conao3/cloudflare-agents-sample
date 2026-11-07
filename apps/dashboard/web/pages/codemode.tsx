import { useAgent } from "agents/react"
import { useCallback, useEffect, useState } from "react"
import { ChatView } from "../chat-view.tsx"
import { Card } from "../ui.tsx"

type Todo = { id: number; title: string; done: number; tag: string }

const TodoPanel = ({ todos }: { todos: Todo[] }) => (
  <Card title={`Todos in SQLite (${todos.length})`}>
    {todos.length === 0 ? (
      <p className="text-sm text-zinc-500">No todos yet.</p>
    ) : (
      <ul className="flex flex-col gap-1 text-sm">
        {todos.map((todo) => (
          <li key={todo.id} className="flex items-center gap-2">
            <span className={todo.done === 1 ? "text-green-700" : "text-zinc-400"}>
              {todo.done === 1 ? "✓" : "○"}
            </span>
            <span className={todo.done === 1 ? "text-zinc-500 line-through" : "text-zinc-900"}>
              {todo.title}
            </span>
            {todo.tag !== "" && (
              <code className="ml-auto rounded bg-zinc-100 px-1 text-xs">{todo.tag}</code>
            )}
          </li>
        ))}
      </ul>
    )}
    <p className="mt-3 text-xs text-zinc-500">
      Open a <code>codemode</code> tool call to see the program the model wrote. It runs in a
      Dynamic Worker without network access and can only reach the tools.
    </p>
  </Card>
)

export const CodemodePage = () => {
  const agent = useAgent({ agent: "codemode-agent", name: "default" })
  const [todos, setTodos] = useState<Todo[]>([])
  const load = useCallback(async () => {
    setTodos(await agent.call<Todo[]>("todos", []))
  }, [agent])
  useEffect(() => {
    if (agent.identified) void load()
  }, [agent.identified, load])
  return (
    <ChatView
      agentName="codemode-agent"
      instance="default"
      suggestions={[
        "Add three todos for a trip to Kyoto, tagged travel.",
        "Mark every travel todo as done and tell me what is left.",
      ]}
      onTurnEnd={() => void load()}
      side={<TodoPanel todos={todos} />}
    />
  )
}
