import type { AITool } from "@cloudflare/ai-chat/react"
import { dynamicToolsModel } from "@cfas/dynamic-tools/types"
import { useMemo, useState } from "react"
import * as z from "zod"
import { ChatView } from "../chat-view.tsx"
import { Button, Card } from "../ui.tsx"

const rollInput = z.object({ sides: z.number().int().min(2).max(100) })

const catalog = {
  getPageInfo: {
    description: "Get the title and URL of the page the user has open",
    parameters: { type: "object", properties: {}, required: [] },
    execute: async () => ({ title: document.title, url: window.location.href }),
  },
  getBrowserTime: {
    description: "Get the user's local time and timezone from the browser",
    parameters: { type: "object", properties: {}, required: [] },
    execute: async () => ({
      time: new Date().toLocaleString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  },
  getScreenSize: {
    description: "Get the size of the user's browser window and its pixel ratio",
    parameters: { type: "object", properties: {}, required: [] },
    execute: async () => ({
      width: window.innerWidth,
      height: window.innerHeight,
      pixelRatio: window.devicePixelRatio,
    }),
  },
  rollDie: {
    description: "Roll one die with the given number of sides in the browser",
    parameters: {
      type: "object",
      properties: { sides: { type: "integer", minimum: 2, maximum: 100 } },
      required: ["sides"],
    },
    execute: async (input: unknown) => {
      const { sides } = rollInput.parse(input)
      return { sides, value: 1 + Math.floor(Math.random() * sides) }
    },
  },
} satisfies Record<string, AITool>

const entries = Object.entries(catalog)

export const DynamicToolsPage = () => {
  const [enabled, setEnabled] = useState<readonly string[]>(["getPageInfo", "getBrowserTime"])
  const tools = useMemo(
    () =>
      enabled.length === 0
        ? undefined
        : Object.fromEntries(entries.filter(([name]) => enabled.includes(name))),
    [enabled],
  )

  return (
    <ChatView
      agentName="dynamic-tools-agent"
      instance="default"
      tools={tools}
      suggestions={[
        "What page am I on?",
        "What time is it for me?",
        "Roll a 20-sided die.",
        "How big is my browser window?",
      ]}
      side={
        <Card title={`Tools registered by this page (${enabled.length})`}>
          <ul className="mb-3 flex flex-col gap-2">
            {entries.map(([name, tool]) => {
              const on = enabled.includes(name)
              return (
                <li key={name} className="flex items-start gap-2 text-sm">
                  <div className="flex-1">
                    <code className={on ? "font-semibold text-zinc-900" : "text-zinc-400"}>
                      {name}
                    </code>
                    <p className="text-xs text-zinc-500">{tool.description}</p>
                  </div>
                  {on ? (
                    <Button
                      tone="danger"
                      onClick={() => setEnabled((current) => current.filter((n) => n !== name))}
                    >
                      Remove
                    </Button>
                  ) : (
                    <Button
                      tone="secondary"
                      onClick={() => setEnabled((current) => [...current, name])}
                    >
                      Add
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
          <p className="text-xs text-zinc-600">
            The agent has no tools of its own. Each message carries the schemas of the tools listed
            here, the agent builds them with <code>createToolsFromClientSchemas</code>, and the
            browser runs the call. Remove a tool and ask again: the model no longer sees it.
          </p>
          <p className="mt-3 text-xs text-zinc-500">
            Model: <code>{dynamicToolsModel}</code>
          </p>
        </Card>
      }
    />
  )
}
