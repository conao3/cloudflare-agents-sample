# voice

`VoiceAgent` is `withVoice(Agent)`. The browser's `useVoiceAgent` streams microphone audio over the agent's WebSocket; `WorkersAIFluxSTT` (`@cf/deepgram/flux`) turns it into text, `onTurn` answers with a model and two tools (`get_time`, `set_reminder`), and `WorkersAITTS` (`@cf/deepgram/aura-1`) speaks the answer. `set_reminder` schedules `speakReminder`, which speaks to every connected caller.

The free allocation covers about 14 minutes of speech recognition and 7,300 characters of speech a day. Try it from the dashboard at `#/voice`; you can also type instead of speaking.
