import type { ReactNode } from "react"

const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g

export const InlineMarkdown = ({ text }: { text: string }): ReactNode =>
  text.split(pattern).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={i} className="rounded bg-black/10 px-1 text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      )
    }
    return part
  })
