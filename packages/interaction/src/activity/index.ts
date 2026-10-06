import { idSchema, referenceSchema, nativeActivityDataSchema, type NativeActivity, type NativeActivityPage, type NativeActivityReference, type TaskSummary } from "@flow/contracts";
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
export const nativeActivityIdentity = (row: NativeActivityReference) => JSON.stringify([row.id, row.activityId, row.taskId, row.attemptId, row.eventId, row.sequence, row.createdAt, row.nativeSessionId, row.source, row.sourceMessageId, row.nativeMessageId, row.blockIndex, row.parentToolUseId, row.kind, row.phase, row.toolUseId, row.toolName, row.detail]);

function validateHeader(row: NativeActivityReference, taskId: string) {
  if (!row || row.taskId !== taskId || !digest(row.activityId) || row.id !== row.activityId
    || ![row.taskId, row.attemptId, row.eventId].every(value => idSchema.safeParse(value).success)
    || !Number.isSafeInteger(row.sequence) || row.sequence < 0 || !Number.isFinite(Date.parse(row.createdAt))
    || !["observed", "redacted", "input-ready", "running", "succeeded", "failed", "unknown"].includes(row.status)
    || (row.kind !== "tool" && row.status !== row.phase)
    || (row.kind === "tool" && !["input-ready", "running", "succeeded", "failed", "unknown"].includes(row.status))
    || (row.detail !== null && !referenceSchema.safeParse(row.detail).success)
    || (row.detail?.activity && row.detail.activity.activityId !== row.activityId)) throw Error("Native activity header does not match this task.");
  nativeActivityDataSchema.parse({ type: "native-activity", activityId: row.activityId, nativeSessionId: row.nativeSessionId,
    source: row.source, sourceMessageId: row.sourceMessageId, nativeMessageId: row.nativeMessageId, blockIndex: row.blockIndex,
    parentToolUseId: row.parentToolUseId, kind: row.kind, phase: row.phase, toolUseId: row.toolUseId, toolName: row.toolName, body: null });
}
export function parseNativeActivityPage(page: NativeActivityPage, taskId: string, after: string | null) {
  if (!page || !Array.isArray(page.activities) || page.activities.length > 20 || (page.nextCursor !== null && !digest(page.nextCursor))) throw Error("Invalid native activity page.");
  const ids = new Set<string>();
  for (const row of page.activities) { validateHeader(row, taskId); if (ids.has(row.id) || row.id === after) throw Error("Native activity page repeats its cursor."); ids.add(row.id); }
  if (page.nextCursor !== null && page.nextCursor !== page.activities.at(-1)?.id) throw Error("Native activity next cursor does not match its page.");
  return page;
}
export function parseNativeActivityBody(data: NativeActivity, header: NativeActivityReference) {
  validateHeader(data, header.taskId);
  if (nativeActivityIdentity(data) !== nativeActivityIdentity(header)) throw Error("Native activity body identity does not match the loaded observation.");
  nativeActivityDataSchema.parse({ type: "native-activity", activityId: data.activityId, nativeSessionId: data.nativeSessionId,
    source: data.source, sourceMessageId: data.sourceMessageId, nativeMessageId: data.nativeMessageId, blockIndex: data.blockIndex,
    parentToolUseId: data.parentToolUseId, kind: data.kind, phase: data.phase, toolUseId: data.toolUseId, toolName: data.toolName, body: data.body });
  return data;
}
