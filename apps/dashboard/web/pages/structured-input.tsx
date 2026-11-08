import { structuredInputModel } from "@cfas/structured-input/types"
import { getToolName } from "ai"
import { useState, type ReactNode } from "react"
import * as z from "zod"
import { ChatView, type ToolPart } from "../chat-view.tsx"
import { Button, Card } from "../ui.tsx"

const choiceInput = z.object({
  question: z.string(),
  options: z.array(z.string()),
  allowMultiple: z.boolean().optional(),
})
const yesNoInput = z.object({ question: z.string() })
const ratingInput = z.object({
  question: z.string(),
  min: z.number().optional(),
  max: z.number().optional(),
})

const Form = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="w-full max-w-[85%] rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm">
    <p className="mb-2 font-medium text-zinc-900">{title}</p>
    {children}
  </div>
)

const Answered = ({ question, answer }: { question: string; answer: unknown }) => (
  <div className="w-full max-w-[85%] rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
    <p className="text-zinc-600">{question}</p>
    <p className="font-medium text-zinc-900">
      {Array.isArray(answer) ? answer.join(", ") : String(answer)}
    </p>
  </div>
)

const ChoiceForm = ({
  input,
  answer,
}: {
  input: z.infer<typeof choiceInput>
  answer: (output: unknown) => void
}) => {
  const [picked, setPicked] = useState<string[]>([])
  const multiple = input.allowMultiple === true
  const toggle = (option: string) =>
    setPicked((current) =>
      multiple
        ? current.includes(option)
          ? current.filter((o) => o !== option)
          : [...current, option]
        : [option],
    )
  return (
    <Form title={input.question}>
      <div className="mb-2 flex flex-wrap gap-2">
        {input.options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => toggle(option)}
            className={`rounded-full border px-3 py-1 ${picked.includes(option) ? "border-orange-500 bg-orange-500 text-white" : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"}`}
          >
            {option}
          </button>
        ))}
      </div>
      <Button
        onClick={() => answer(multiple ? picked : picked[0])}
        disabled={picked.length === 0}
        disabledReason={multiple ? "Pick at least one option" : "Pick an option"}
      >
        Submit
      </Button>
    </Form>
  )
}

const RatingForm = ({
  input,
  answer,
}: {
  input: z.infer<typeof ratingInput>
  answer: (output: unknown) => void
}) => {
  const min = input.min ?? 1
  const max = Math.min(input.max ?? 5, min + 9)
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i)
  return (
    <Form title={input.question}>
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => answer(value)}
            className="size-9 rounded-md border border-zinc-300 bg-white font-medium text-zinc-800 hover:border-orange-500 hover:bg-orange-100"
          >
            {value}
          </button>
        ))}
      </div>
    </Form>
  )
}

const renderTool = (part: ToolPart, answer: (output: unknown) => void): ReactNode | undefined => {
  const name = getToolName(part)
  if (part.state === "input-streaming") {
    return <p className="text-xs text-zinc-500">Preparing a form ({name})…</p>
  }
  const parsed =
    name === "askChoice"
      ? choiceInput.safeParse(part.input)
      : name === "askYesNo"
        ? yesNoInput.safeParse(part.input)
        : name === "askRating"
          ? ratingInput.safeParse(part.input)
          : undefined
  if (parsed === undefined || !parsed.success) return undefined
  const question = parsed.data.question
  if (part.state === "output-available") {
    return <Answered question={question} answer={part.output} />
  }
  if (part.state !== "input-available") return undefined
  if (name === "askChoice") {
    return <ChoiceForm input={choiceInput.parse(part.input)} answer={answer} />
  }
  if (name === "askYesNo") {
    return (
      <Form title={question}>
        <div className="flex gap-2">
          <Button onClick={() => answer("yes")}>Yes</Button>
          <Button tone="secondary" onClick={() => answer("no")}>
            No
          </Button>
        </div>
      </Form>
    )
  }
  return <RatingForm input={ratingInput.parse(part.input)} answer={answer} />
}

export const StructuredInputPage = () => (
  <ChatView
    agentName="structured-input-agent"
    instance="default"
    renderTool={renderTool}
    suggestions={[
      "Help me plan a weekend trip.",
      "Run a quick survey about my coffee habits.",
      "Help me pick a programming language for a side project.",
    ]}
    side={
      <Card title="What to try">
        <ul className="flex list-disc flex-col gap-2 pl-4 text-sm text-zinc-700">
          <li>
            <code>askChoice</code>, <code>askYesNo</code>, and <code>askRating</code> have a schema
            and no <code>execute</code>, so each call stops at <code>input-available</code> in the
            browser.
          </li>
          <li>
            The page renders the call as a form; submitting it calls <code>addToolOutput</code> and
            the model continues with your answer.
          </li>
          <li>Answered forms stay in the history with the value you gave.</li>
        </ul>
        <p className="mt-3 text-xs text-zinc-500">
          Model: <code>{structuredInputModel}</code>
        </p>
      </Card>
    }
  />
)
