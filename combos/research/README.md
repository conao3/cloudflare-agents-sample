# research

Chat + Browser Run + approval + scheduling. `ResearchAgent` (an `AIChatAgent`) reads pages with `createQuickActionTools`. Its `watchPage` tool has `needsApproval`; once approved it calls `scheduleEvery`, and each run re-reads the page with `browserMarkdown`, summarizes it, and adds a note to the agent's state.

Try it from the dashboard at `#/research`. Stop watches you no longer need: each run uses browser minutes.
