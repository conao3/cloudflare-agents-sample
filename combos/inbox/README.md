# inbox

Email + RAG + Workers AI. `InboxAgent.onEmail` searches the Vectorize index of the `rag` sample (namespace `default`) with the mail's subject and body, writes a reply from the matching chunks, sends it with `replyToEmail`, and records the thread with its sources.

Load the RAG sample documents first, then deliver simulated mail from the dashboard at `#/inbox`.
