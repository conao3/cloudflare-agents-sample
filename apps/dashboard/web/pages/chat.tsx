import { chatModel } from "@cfas/chat/types"
import { ChatView } from "../chat-view.tsx"
import { Card } from "../ui.tsx"

export const ChatPage = () => (
  <ChatView
    agentName="chat-agent"
    instance="default"
    suggestions={[
      "What's the weather in Toronto?",
      "What time is it where I am?",
      "Send 50 points to Alice.",
    ]}
    side={
      <Card title="What to try">
        <ul className="flex list-disc flex-col gap-2 pl-4 text-sm text-zinc-700">
          <li>
            <code>getWeather</code> runs on the server and returns at once.
          </li>
          <li>
            <code>getLocalTime</code> has no server code: the browser answers it in{" "}
            <code>onToolCall</code>.
          </li>
          <li>
            <code>transferPoints</code> has <code>needsApproval</code>, so the turn pauses until you
            press Approve or Reject.
          </li>
          <li>Reload the page: the history is stored in the agent's SQLite.</li>
        </ul>
        <p className="mt-3 text-xs text-zinc-500">
          Model: <code>{chatModel}</code>
        </p>
      </Card>
    }
  />
)
