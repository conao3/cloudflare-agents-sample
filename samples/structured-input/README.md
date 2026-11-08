# structured-input

`StructuredInputAgent` is an `AIChatAgent` whose tools have a schema and no `execute`: `askChoice`, `askYesNo`, and `askRating`. The model picks the kind of question, the tool part reaches the browser in state `input-available`, and the page renders it as a form (options, Yes / No buttons, a rating scale). Submitting the form calls `addToolOutput`, and the model continues with the answer as the tool result.

Try it from the dashboard at `#/structured-input`.
