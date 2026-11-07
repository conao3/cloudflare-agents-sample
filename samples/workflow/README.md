# workflow

`WorkflowAgent` starts `ApprovalWorkflow` with `runWorkflow`. The workflow runs `draft` → `review` → `waitForApproval` → `publish`; each `step.do` result is persisted and retried. The workflow reports progress with `reportProgress`, and the agent turns `onWorkflowProgress` / `onWorkflowComplete` / `onWorkflowError` into state that every tab sees.

`approveWorkflow` and `rejectWorkflow` resume the waiting step. Try it from the dashboard at `#/workflow`.
