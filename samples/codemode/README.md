# codemode

`CodemodeAgent` gives the model one tool, `codemode`, made with `createCodeTool`. The model writes a JavaScript program that calls `addTodo`, `listTodos`, and `setDone` on a `codemode` object; `DynamicWorkerExecutor` runs it in a Dynamic Worker (`worker_loaders`) without network access. The todos live in the agent's SQLite.

Try it from the dashboard at `#/codemode` and open the `codemode` tool call to read the program.
