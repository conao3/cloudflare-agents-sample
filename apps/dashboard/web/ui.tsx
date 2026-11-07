import type { ReactNode } from "react"

export const Card = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="rounded-lg border border-zinc-200 bg-white p-4">
    <h2 className="mb-3 text-sm font-semibold text-zinc-700">{title}</h2>
    {children}
  </section>
)

export const Button = ({
  children,
  onClick,
  disabled,
  disabledReason,
  tone = "primary",
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  disabledReason?: string
  tone?: "primary" | "secondary" | "danger"
}) => {
  const tones = {
    primary: "bg-orange-500 text-white hover:bg-orange-600",
    secondary: "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50",
    danger: "border border-red-300 bg-white text-red-700 hover:bg-red-50",
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]}`}
    >
      {children}
    </button>
  )
}

export const ConnectionBadge = ({ connected }: { connected: boolean }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs ${connected ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-600"}`}
  >
    <span className={`size-1.5 rounded-full ${connected ? "bg-green-600" : "bg-zinc-400"}`} />
    {connected ? "Connected" : "Connecting"}
  </span>
)

export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="flex flex-col gap-1 text-xs text-zinc-600">
    {label}
    {children}
  </label>
)

export const inputClass =
  "rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 focus:border-orange-500 focus:outline-none"

export const formatTime = (iso: string): string => new Date(iso).toLocaleTimeString()
