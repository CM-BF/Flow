# X01 owner management interface

Canonical parent: X01 `plans/x01-plugin-management`, X01-02/06. This subtask adds only four management calls, not the runner phase API.

| FlowClient method | Actual runCli argv | Existing owner route |
| --- | --- | --- |
| pluginRuntime(id, signal?) | plugin runtime PLUGIN | GET /api/plugins/:id/runtime |
| commandPluginRuntime(id, PluginRuntimeCommand, key, signal?) | plugin runtime-change PLUGIN --input FILE --key KEY | POST /api/plugins/:id/runtime/commands |
| admitPluginToolTask(id, PluginToolTaskRequest, key, signal?) | plugin tool-task PLUGIN --input FILE --key KEY | POST /api/plugins/:id/tool-tasks |
| pluginToolBinding(taskId, signal?) | plugin binding TASK | GET /api/tasks/:id/plugin-binding |

The existing `runCli(args, io, env, signal?)` is the entry. CLI reuses parseArgs/readJsonInput and the original FlowClient transport: bearer or explicit cookie mode, current CSRF, bounded response decoding and cancellation. New pure plugin-management owns detached request identity and ACK association; it does not send requests. Source contracts remain `packages/contracts/src/plugin-runtime.ts`.

Input files are at most 32768 encoded bytes, including whitespace. Server wire entity and compact parsed schema have their own 32768-byte bounds; this is not acceptance of every equivalent JSON representation. Input schema errors and absent/invalid keys are usage exit2; well-formed typed center rejection preserves FlowApiError (409 exit3, others4). A malformed/mismatched/oversized response, lost connection or cancellation after sending becomes `plugin_ack_unknown`/exit4, retaining exact route, key and serialized detached input. No automatic retries, revised revision/key or fallback. There is no query-by-key endpoint; current GET/list cannot prove a prior mutation absent. Recover only explicitly with the same route/key/body. Successful replay is historical evidence, not permission to repeat a tool effect.

All four success bodies are bounded to 65536 decoded UTF-8 bytes, errors to4096 before parsing; arbitrary proxy data/extra whitespace remain subject to receive policy. These are not TCP/heap/one-chunk allocation limits. Runtime GET must match registration; binding GET must match task. Mutation ACK binds operation/installation/runtime IDs, kind and before/after revisions plus the precise enabled install/runner/store tuple (all null on disable). Tool ACK binds queued fixture carrier, title/task/binding IDs, registration revision and original input SHA256. AcceptedTask does not return prompt; no nonexistent full-prompt check is claimed. Data schemas remain single contract authority.

Enable needs explicit materialInstallOperationId, targetRunnerId and storeId supplied by caller; installed-material DTO has no targetRunnerId and a disabled runtime has null tuple. No owner-host discovery API exists. Neither ordinary runner listing nor installed material proves host qualification; center rechecks actual host/install/config/grants. Enabled/bindingAllowed does not prove loaded/callable (both remain unknown). Disable prevents new bindings without erasing old pin; set-grants removes live phase permission separately.

Legacy configure/set-grants still use existing `plugin change`/commandPlugin. Their current response is not covered by this new ACK codec. A Web consumer must not assume those legacy writes gained runtime validation. First UI may consume the four methods here and explicitly ask for the initial exact enable tuple; no new host-discovery endpoint is introduced.

Architecture_read owns trusted server/runner startup. Its fixed `bac95641` process acceptance design can substitute these four runCli calls in one dedicated DB journey; fetch/install/grant remain existing HTTP. That real HTTP/process acceptance is NOT_RUN here, and no consumed PG window is reused. This local slice proves actual CLI→FlowClient→mock Fetch, not server DB authorization, SDK execution, provider behavior or deployment.
