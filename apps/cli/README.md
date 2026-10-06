# Flow CLI

Use Node 24 and the repository's pnpm version. Run `pnpm cli --help` from the workspace root. Set `FLOW_URL` to the center URL (default `http://127.0.0.1:4310`) and `FLOW_TOKEN` to the owner token; never commit that token.

```sh
pnpm cli submit "Prepare a fixture result" --key stable-request --json
pnpm cli list
pnpm cli show TASK_ID
pnpm cli watch TASK_ID --timeout 30000
pnpm cli decision TASK_ID approve --decision DECISION_ID --key stable-decision
pnpm cli detail REFERENCE_ID
pnpm cli cancel TASK_ID --key stable-cancel
```

`--json` emits JSON objects (watch emits one per line). `submit` defaults to the explicitly deterministic `fixture` harness; choose `--harness claude` only after configuring a Claude-capable runner. Optional fixture scenarios: success, decision, failure, verification-failure, slow, large. `--expect text` selects deterministic contains verification; execution success and verification success are distinct.

Use a stable `--key` to retry a submission/decision/cancellation whose response was lost; an omitted key is fresh each invocation. A conflicting reuse exits 3. `show` and `watch` show bounded recent entries and references; `events TASK_ID --after CURSOR` pages earlier evidence and `detail REFERENCE_ID` expands it.

`watch` resumes at the last delivered cursor after a transient disconnect. Ctrl-C or `--timeout` ends observation only; background work continues. Use `cancel` for an explicit stop request, which may first return `cancel_requested`. A runner already executing a tool may have produced effects; `uncertain` requires reconciliation.

Exit codes: 0 command accepted or verified success; 2 usage/configuration; 3 conflict; 4 HTTP/transport failure; watch terminal 10 execution failed, 11 cancelled, 12 execution succeeded but verification not passed, 13 uncertain; 124 observation timeout; 130 observation interrupted. Command acceptance is not task completion.

`runner register --name NAME [--harness fixture|claude] [--capacity 1]` emits a one-time runner credential; store it securely for the runner. `runner revoke RUNNER_ID` revokes that credential. The owner credential cannot call runner-only routes.
