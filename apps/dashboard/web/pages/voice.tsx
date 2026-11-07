import { useVoiceAgent } from "agents/voice/react"
import { useState } from "react"
import { Button, Card, inputClass } from "../ui.tsx"

const statusText: Record<string, string> = {
  idle: "Idle",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
}

export const VoicePage = () => {
  const voice = useVoiceAgent({ agent: "voice-agent", name: "default" })
  const [text, setText] = useState("")
  const inCall = voice.status !== "idle"
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
      <Card title="Call">
        <div className="mb-4 flex items-center gap-3">
          <span
            className={`size-3 rounded-full ${voice.connected ? (inCall ? "bg-green-500" : "bg-zinc-400") : "bg-red-400"}`}
          />
          <span className="text-sm text-zinc-700">
            {voice.connected ? (statusText[voice.status] ?? voice.status) : "Connecting"}
          </span>
        </div>
        <div className="mb-4 h-2 overflow-hidden rounded bg-zinc-100">
          <div
            className="h-full bg-orange-500 transition-all"
            style={{ width: `${Math.min(100, voice.audioLevel * 400)}%` }}
          />
        </div>
        <div className="flex gap-2">
          {inCall ? (
            <Button tone="danger" onClick={voice.endCall}>
              End call
            </Button>
          ) : (
            <Button
              onClick={() => void voice.startCall()}
              disabled={!voice.connected}
              disabledReason="Waiting for the WebSocket connection"
            >
              Start call
            </Button>
          )}
          <Button
            tone="secondary"
            onClick={voice.toggleMute}
            disabled={!inCall}
            disabledReason="Start a call first"
          >
            {voice.isMuted ? "Unmute" : "Mute"}
          </Button>
        </div>
        {voice.error !== null && <p className="mt-3 text-sm text-red-700">{voice.error}</p>}
        <p className="mt-4 text-xs text-zinc-500">
          The browser streams microphone audio over the agent's WebSocket. Workers AI transcribes it
          with Deepgram Flux, the model answers, and Deepgram Aura reads the answer back. Try “What
          time is it?” or “Remind me in 10 seconds to stretch.” The free allocation covers about 14
          minutes of speech recognition a day.
        </p>
      </Card>
      <Card title="Transcript">
        <ul className="mb-3 flex max-h-96 min-h-48 flex-col gap-2 overflow-y-auto">
          {voice.transcript.length === 0 && voice.interimTranscript === null && (
            <li className="text-sm text-zinc-500">Start a call and speak, or type below.</li>
          )}
          {voice.transcript.map((m) => (
            <li
              key={`${m.timestamp}-${m.role}`}
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "self-end bg-orange-500 text-white" : "self-start bg-zinc-100 text-zinc-900"}`}
            >
              {m.text}
            </li>
          ))}
          {voice.interimTranscript !== null && (
            <li className="self-end text-sm italic text-zinc-500">{voice.interimTranscript}</li>
          )}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (text.trim() === "") return
            voice.sendText(text.trim())
            setText("")
          }}
        >
          <input
            className={`${inputClass} flex-1`}
            value={text}
            placeholder="Type instead of speaking"
            onChange={(e) => setText(e.target.value)}
          />
          <Button
            onClick={() => {
              voice.sendText(text.trim())
              setText("")
            }}
            disabled={!voice.connected || text.trim() === ""}
            disabledReason={
              voice.connected ? "Type a message" : "Waiting for the WebSocket connection"
            }
          >
            Send
          </Button>
        </form>
      </Card>
    </div>
  )
}
