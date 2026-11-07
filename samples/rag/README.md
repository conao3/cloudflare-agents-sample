# rag

`RagAgent` splits documents into paragraph chunks, embeds them with `@cf/baai/bge-m3` (1024 dimensions), and upserts them into the Vectorize index `cfas-rag` in the namespace of the agent's name. `search` embeds the query and asks Vectorize for the nearest chunks; `ask` answers from those chunks with citations.

Create the index once with `wrangler vectorize create cfas-rag --dimensions=1024 --metric=cosine`. New vectors take a few seconds to become searchable. Try it from the dashboard at `#/rag`.
