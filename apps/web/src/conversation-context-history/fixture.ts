import type { ContextHistoryResponse } from "../../../../packages/contracts/src/context-observation-history.js";

/** Contract-shaped data only; no center, model, HTTP or import side effect. */
export function historyFixture(taskId = "task-a"): ContextHistoryResponse {
  const detailRef = { id: "detail-1", title: "Claude context summary" as const };
  const reading = { kind: "estimate" as const, value: 0, source: { name: "claude-sdk-context" as const, version: "0.3.290" }, measurementMethod: "sdk-summary-estimate" as const,
    tokenBasis: "claude-context-summary-0.3.290", coverage: "partial" as const, evidenceRef: detailRef };
  return { protocol: "flow.context-history.v1", taskId, attemptId: "attempt-1", current: { kind: "unknown", value: null, reason: "history-only" }, remaining: { kind: "unknown", value: null, reason: "history-only" },
    latest: { eventSequence: 4, receivedAt: "2026-10-07T10:00:02.000Z", detailRef, materials: { state: "unknown", reason: "metadata-unavailable" },
      observation: { id: "observation-1", observedAt: "2026-10-07T10:00:00.000Z", identity: { subject: { kind: "attempt", taskId, attemptId: "attempt-1", ownerVersion: 1, nativeSessionId: "native-1" },
        harness: "claude", requestedModel: "requested-model", resolvedModel: "observed-model", profile: { id: "00000000-0000-4000-8000-000000000001", runnerId: "00000000-0000-4000-8000-000000000002", configDigest: "a".repeat(64) },
        executionInputDigest: "b".repeat(64), materialRevisionDigest: null, historyEpoch: null }, used: reading, compactionWindow: { ...reading, value: 128000 },
        modelCapacity: { kind: "unknown", value: null, reason: "not-observed" }, categories: [], compression: { state: "not-observed" } } } };
}
