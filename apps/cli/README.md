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

## Versioned knowledge

`knowledge create --project PROJECT_ID --input source.json --key create-once` accepts `{"expectedVersion":0,"title":"Release notes","text":"original text"}`. `knowledge publish SOURCE_ID --project PROJECT_ID --input version.json --key publish-once` accepts `{"expectedVersion":1,"text":"revised text"}`. These commands store manual source text, not embeddings or model output.

Use `knowledge list|show|version|search|resolve` (see `--help`). `resolve` reads a file containing `{"citation":...}` copied from a search hit. It returns the fixed source version and exact UTF-8 range even after a newer version is published; `isCurrent` and `currentVersion` identify that distinction. Search is bounded lexical matching, not semantic search.

Input is read with a byte bound before parsing. Knowledge text is at most 262144 UTF-8 bytes; its JSON envelope allows up to 1576960 bytes for worst-case escaping and metadata. The schema still enforces raw-text limits. Existing project/goal/reconciliation JSON limits remain 128 KiB, plugin input 32 KiB. Invalid UTF-8, JSON and over-limit input exit 2; files must be regular files. No input is trimmed or normalized.

## Explicit native goal child

`goal execute-native <goal-id> --input JSON-file --key stable-key` is an owner-only request to execute one existing fixed node input with an already registered `configured-readonly` Claude profile. Its bounded JSON file contains `nodeId`, `expectedInputVersion`, exact `dependencies`, `previousExecutionId`, `reason`, and `executionProfile` (`id`, `runnerId`, `configDigest`). Copy the current version and pin; do not invent a prompt or add fixture/tool permissions. Input is limited to 128 KiB and validated before sending.

The required stable key recovers the same receipt after a lost response; a conflict exits 3 without retry. Receipt/queued means admission only. Mechanical verification and explicit owner acceptance remain separate; this command does not certify meaning or enable engineering writes. Existing `goal change` fixture execution is unchanged. No model is called by CLI help or input validation.

`pnpm cli usage TASK_ID` reads the same owner-authorized source/cache/coverage summary as the shared client. It keeps unknown quantities as `null`, retains the unchanged legacy summary, and labels SDK estimates separately from provider billing. This read-only command starts no task or model; historical producer version, phase attribution and coverage may remain unverified.

## Static plugin material

`plugin install PLUGIN VERSION --input FILE --key KEY` accepts an exact registered revision and successful fetch operation/attempt (`expectedRevision`, `fetchOperationId`, `fetchAttemptId`, `reason`). The required stable key recovers its original acceptance receipt; it does not report current completion. Read current state with `plugin install-show OP`, list with `plugin installs PLUGIN`, and page audit with `plugin install-history OP`; lists accept `--after` and `--limit`.

`plugin install-change OP --input FILE --key KEY` accepts `{ "action": "start" | "reconcile", "reason": "..." }`. All mutation files are bounded to 4096 bytes and strictly validated. Conflicts exit 3 without retry; unknown transport outcomes keep the original key/body. Static `installed` means verified local material only, not enabled, loaded, callable or isolated. Reconciliation without proven execution settlement remains unknown.

These routes are disabled until the center host sets `FLOW_PLUGIN_INSTALL_CONFIG` to an owned 0600 regular JSON file. It contains only `artifactStore: {root, storeId}` and `materialStore: {root, storeId, allowedDigests}`; roots must be canonical absolute paths and at most 512 permitted SHA-256 digests are accepted. This private configuration is capped at 65536 bytes, cannot inject credentials, URLs or a lifecycle callback, and is never a public command argument. Existing personal preview configuration is unchanged.
