import { assistantStreamSelectionSchema, type AssistantStreamSelection } from '../../../contracts/src/assistant-stream.js';
import {
  ASSISTANT_ATTEMPT_BYTES, assistantStreamDataSchema, assistantStreamIdentity, idSchema,
  type AssistantStreamData, type AssistantStreamPage, type AssistantStreamPatch,
  type AssistantStreamReference, type AssistantStreamSettlement,
} from "@flow/contracts";

export const MAX_STREAM_BLOCKS = 256;
export const MAX_STREAM_PATCHES = 4096;
const encoder = new TextEncoder();
const digestPattern = /^[a-f0-9]{64}$/;
const statuses = ["queued", "running", "waiting", "cancel_requested", "succeeded", "failed", "cancelled", "uncertain"];
export const utf8Bytes = (text: string) => encoder.encode(text).byteLength;
export async function textDigest(text: string): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(text)))].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
function object(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw Error("Invalid stream response.");
  return Object.fromEntries(Object.entries(value));
}
function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) throw Error("Invalid stream counter.");
  return value;
}
function id(value: unknown): string { return idSchema.parse(value); }
function digest(value: unknown): string {
  if (typeof value !== "string" || !digestPattern.test(value)) throw Error("Invalid stream digest.");
  return value;
}
function time(value: unknown): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw Error("Invalid stream timestamp.");
  return value;
}
function nullableId(value: unknown): string | null { return value === null ? null : id(value); }
function boolean(value: unknown): boolean { if (typeof value !== "boolean") throw Error("Invalid stream boolean."); return value; }
function dataOf(value: Record<string, unknown>, text: unknown, fromBytes: unknown): AssistantStreamData {
  return assistantStreamDataSchema.parse({ type: value.type ?? "assistant-stream", streamId: value.streamId, nativeSessionId: value.nativeSessionId,
    nativeMessageId: value.nativeMessageId, parentToolUseId: value.parentToolUseId, source: value.source, sourceMessageId: value.sourceMessageId,
    ...(value.nativeTurnId !== undefined ? { nativeTurnId: value.nativeTurnId } : {}),
    ...(value.channel !== undefined ? { channel: value.channel } : {}), blockIndex: value.blockIndex, revision: value.revision, fromBytes, text, prefixDigest: value.prefixDigest,
    phase: value.phase, reason: value.reason, truncated: value.truncated });
}
async function verifySource(value: AssistantStreamData) {
  if (value.streamId !== await textDigest(assistantStreamIdentity(value))) throw Error("Stream identity does not match its source.");
}
async function referenceOf(input: unknown, taskId: string, attemptId: string): Promise<AssistantStreamReference> {
  const value = object(input);
  const data = dataOf(value, value.phase === "streaming" ? "x" : "", 0);
  await verifySource(data);
  if (value.id !== data.streamId || value.taskId !== taskId || value.attemptId !== attemptId) throw Error("Stream metadata identity does not match this attempt.");
  const firstSequence = integer(value.firstSequence, 1), lastSequence = integer(value.lastSequence, firstSequence);
  const status = value.status;
  if (status !== "streaming" && status !== "block-complete" && status !== "incomplete" && status !== "superseded" && status !== "interrupted" && status !== "final-available") throw Error("Invalid stream status.");
  const { type: _type, text: _text, fromBytes: _fromBytes, ...header } = data;
  return Object.freeze({ ...header, id: data.streamId, taskId, attemptId, firstSequence, lastSequence, bytes: integer(value.bytes, 0, ASSISTANT_ATTEMPT_BYTES),
    createdAt: time(value.createdAt), updatedAt: time(value.updatedAt), status });
}
function streamIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > MAX_STREAM_BLOCKS) throw Error("Invalid settlement partition.");
  const ids = value.map(digest);
  if (new Set(ids).size !== ids.length) throw Error("Duplicate settlement identity.");
  return ids;
}
function settlementOf(input: unknown, taskId: string, attemptId: string | null, finalMessageId: string | null): AssistantStreamSettlement | null {
  if (input === null) return null;
  const value = object(input);
  if (!attemptId || !finalMessageId || value.taskId !== taskId || value.attemptId !== attemptId || value.finalMessageId !== finalMessageId
    || value.policy !== "flow.assistant-draft" || value.policyVersion !== "1") throw Error("Settlement does not match the current final.");
  const correlation = value.correlation, reason = value.unavailableReason;
  if (correlation !== "presentation-policy" && correlation !== "unavailable") throw Error("Unknown settlement policy.");
  if (reason !== null && reason !== "no-draft" && reason !== "incomplete-stream" && reason !== "missing-tool-evidence" && reason !== "crossed-tool-boundary") throw Error("Unknown settlement reason.");
  if ((correlation === "unavailable") !== (reason !== null)) throw Error("Inconsistent settlement reason.");
  const replaceStreamIds = streamIds(value.replaceStreamIds), retainStreamIds = streamIds(value.retainStreamIds);
  if (replaceStreamIds.some(streamId => retainStreamIds.includes(streamId)) || (correlation === "unavailable" && replaceStreamIds.length)) throw Error("Unsafe settlement replacement.");
  return Object.freeze({ policy: "flow.assistant-draft", policyVersion: "1", correlation, unavailableReason: reason, taskId, attemptId,
    nativeSessionId: id(value.nativeSessionId), finalMessageId, replaceStreamIds, retainStreamIds });
}
export async function readStreamMetadata(input: unknown, taskId: string): Promise<AssistantStreamPage> {
  const value = object(input);
  if (value.taskId !== taskId || typeof value.taskStatus !== "string" || !statuses.includes(value.taskStatus)) throw Error("Stream metadata belongs to another task.");
  const attemptId = nullableId(value.attemptId), finalMessageId = nullableId(value.finalMessageId);
  if (!Array.isArray(value.blocks) || value.blocks.length > 100 || (!attemptId && (value.blocks.length || finalMessageId !== null))) throw Error("Invalid stream metadata page.");
  const blocks: AssistantStreamReference[] = [];
  for (const inputBlock of value.blocks) {
    if (!attemptId) throw Error("Stream block requires an attempt.");
    const block = await referenceOf(inputBlock, taskId, attemptId);
    if (blocks.some(other => other.id === block.id) || (blocks.at(-1)?.firstSequence ?? 0) >= block.firstSequence) throw Error("Stream metadata is not ordered.");
    blocks.push(block);
  }
  const nextCursor = value.nextCursor === null ? null : digest(value.nextCursor);
  if (nextCursor !== null && nextCursor !== blocks.at(-1)?.id) throw Error("Stream metadata cursor did not advance.");
  return { taskId, attemptId, taskStatus: value.taskStatus, taskUpdatedAt: time(value.taskUpdatedAt), blocks, nextCursor, finalMessageId,
    settlement: settlementOf(value.settlement, taskId, attemptId, finalMessageId) };
}
export function validateMetadataPartition(metadata: AssistantStreamPage) {
  const blocks = metadata.blocks;
  if (blocks.length > MAX_STREAM_BLOCKS || blocks.reduce((sum, block) => sum + block.bytes, 0) > ASSISTANT_ATTEMPT_BYTES
    || new Set(blocks.map(block => block.nativeSessionId)).size > 1) throw Error("Stream attempt exceeds its identity or size budget.");
  const settlement = metadata.settlement;
  if (!settlement) return;
  if (settlement.correlation === "presentation-policy" && blocks.some(block =>
    (block.phase !== "block-complete" && block.phase !== "superseded") || (block.phase === "superseded" && settlement.replaceStreamIds.includes(block.id))))
    throw Error("Settlement cannot replace interrupted or superseded history.");
  const partition = [...settlement.replaceStreamIds, ...settlement.retainStreamIds];
  if (partition.length !== blocks.length || partition.some(streamId => !blocks.some(block => block.streamId === streamId))
    || blocks.some(block => block.nativeSessionId !== settlement.nativeSessionId)) throw Error("Settlement must cover exactly this attempt's blocks.");
}

export interface DraftBlock extends AssistantStreamData {
  taskId: string; attemptId: string; content: string; bytes: number; firstSequence: number; lastSequence: number; createdAt: string;
}
export interface PatchState {
  readonly taskId: string; readonly attemptId: string; readonly cursor: number; readonly totalBytes: number;
  readonly blocks: readonly Readonly<DraftBlock>[];
  readonly receipts: Readonly<Record<number, string>>;
}
export function emptyPatchState(taskId: string, attemptId: string): PatchState {
  id(taskId); id(attemptId);
  return Object.freeze({ taskId, attemptId, cursor: 0, totalBytes: 0, blocks: Object.freeze([]), receipts: Object.freeze({}) });
}
async function patchOf(input: unknown): Promise<AssistantStreamPatch> {
  const value = object(input);
  if (value.type !== "assistant-stream") throw Error("Only assistant stream patches enter the body.");
  const data = dataOf(value, value.text, value.fromBytes); await verifySource(data);
  return { ...data, taskId: id(value.taskId), attemptId: id(value.attemptId), eventId: id(value.eventId), sequence: integer(value.sequence, 1), createdAt: time(value.createdAt) };
}
export async function applyPatchPage(state: PatchState, input: unknown, after: number, references: readonly AssistantStreamReference[]): Promise<{ state: PatchState; hasMore: boolean }> {
  const page = object(input);
  if (page.taskId !== state.taskId || page.attemptId !== state.attemptId) throw Error("Patch page belongs to another attempt.");
  if (!Array.isArray(page.patches) || page.patches.length > 8) throw Error("Patch page exceeds its eight-patch budget.");
  const nextCursor = integer(page.nextCursor), hasMore = boolean(page.hasMore);
  if (after > state.cursor || nextCursor < after || (hasMore && !page.patches.length)) throw Error("Patch cursor did not advance.");
  const blocks = new Map(state.blocks.map(block => [block.streamId, block]));
  const receipts = { ...state.receipts }; let totalBytes = state.totalBytes, last = after;
  for (const raw of page.patches) {
    const patch = await patchOf(raw);
    if (patch.taskId !== state.taskId || patch.attemptId !== state.attemptId || patch.sequence <= last || patch.sequence > nextCursor) throw Error("Patch sequence or identity is invalid.");
    last = patch.sequence;
    const reference = references.find(ref => ref.id === patch.streamId);
    if (!reference || reference.taskId !== patch.taskId || reference.attemptId !== patch.attemptId || reference.nativeSessionId !== patch.nativeSessionId
      || reference.nativeMessageId !== patch.nativeMessageId || reference.blockIndex !== patch.blockIndex || reference.source !== patch.source || reference.channel !== patch.channel || reference.nativeTurnId !== patch.nativeTurnId) throw Error("Patch has no matching current metadata.");
    const fingerprint = await textDigest(JSON.stringify(patch));
    if (receipts[patch.sequence]) {
      if (receipts[patch.sequence] !== fingerprint) throw Error("A sealed patch changed on replay.");
      continue;
    }
    if (patch.sequence <= state.cursor || Object.keys(receipts).length >= MAX_STREAM_PATCHES) throw Error("Patch replay or attempt budget is invalid.");
    const previous = blocks.get(patch.streamId);
    if (!previous && patch.sequence !== reference.firstSequence) throw Error("First patch does not match metadata sequence.");
    if (patch.revision !== (previous?.revision ?? 0) + 1 || patch.fromBytes !== (previous?.bytes ?? 0)) throw Error("Patch revision or UTF-8 offset has a gap.");
    if (previous && previous.phase !== "streaming" && (patch.text !== "" || patch.phase === "streaming" || patch.phase === "block-complete")) throw Error("A closed block cannot append text.");
    if (previous?.phase === "superseded" && patch.phase !== "superseded") throw Error("A superseded block cannot become current.");
    if (!previous && blocks.size >= MAX_STREAM_BLOCKS) throw Error("Too many stream blocks.");
    const content = (previous?.content ?? "") + patch.text, added = utf8Bytes(patch.text);
    if (totalBytes + added > ASSISTANT_ATTEMPT_BYTES) throw Error("Stream attempt exceeds one MiB.");
    if (await textDigest(content) !== patch.prefixDigest) throw Error("Stream prefix digest does not match.");
    if (patch.revision === reference.revision && (reference.bytes !== patch.fromBytes + added || reference.prefixDigest !== patch.prefixDigest
      || reference.phase !== patch.phase || reference.reason !== patch.reason || reference.truncated !== patch.truncated
      || reference.lastSequence !== patch.sequence || reference.firstSequence !== (previous?.firstSequence ?? patch.sequence)))
      throw Error("Sealed patch disagrees with current metadata.");
    blocks.set(patch.streamId, Object.freeze({ ...patch, content, bytes: patch.fromBytes + added, firstSequence: previous?.firstSequence ?? patch.sequence,
      lastSequence: patch.sequence, createdAt: previous?.createdAt ?? patch.createdAt }));
    receipts[patch.sequence] = fingerprint; totalBytes += added;
  }
  if (nextCursor !== last) throw Error("Patch cursor does not match the last included sequence.");
  return { state: Object.freeze({ taskId: state.taskId, attemptId: state.attemptId, cursor: Math.max(state.cursor, nextCursor), totalBytes,
    blocks: Object.freeze([...blocks.values()].sort((a, b) => a.firstSequence - b.firstSequence)), receipts: Object.freeze(receipts) }), hasMore };
}

export function matchesStreamSelection(reference: Pick<AssistantStreamData,'source'|'channel'|'streamId'>, selection: AssistantStreamSelection): boolean {
  return selection.kind === 'block' ? reference.streamId === selection.streamId : reference.source === 'claude.sdk.stream' || reference.channel === 'text';
}
export async function applySelectedPatchPage(state: PatchState, input: unknown, after: number, references: readonly AssistantStreamReference[], selection: AssistantStreamSelection) {
  const page=object(input), actual=assistantStreamSelectionSchema.parse(page.selection);
  if(page.protocol!=='patch-select-v1' || actual.kind!==selection.kind || (actual.kind==='block' && selection.kind==='block' && actual.streamId!==selection.streamId)) throw Error('Selected response identity was not acknowledged.');
  if(!Array.isArray(page.patches) || page.patches.some(raw=>!matchesStreamSelection(dataOf(object(raw),object(raw).text,object(raw).fromBytes),selection))) throw Error('Patch is outside its immutable selection.');
  return applyPatchPage(state,input,after,references.filter(ref=>matchesStreamSelection(ref,selection)));
}
/** A verified initial snapshot supplies this block's own cursor, never the text cursor. */
export async function seedSelectedBlock(input: unknown, reference: AssistantStreamReference): Promise<PatchState> {
  const value=object(input), block=await referenceOf(value,reference.taskId,reference.attemptId);
  if(block.id!==reference.id || assistantStreamIdentity(block)!==assistantStreamIdentity(reference) || block.revision<reference.revision || block.lastSequence<reference.lastSequence) throw Error('Block snapshot identity or revision is stale.');
  if(block.revision===reference.revision && (block.bytes!==reference.bytes || block.prefixDigest!==reference.prefixDigest || block.lastSequence!==reference.lastSequence || block.phase!==reference.phase || block.reason!==reference.reason || block.truncated!==reference.truncated)) throw Error('Block snapshot disagrees at the same revision.');
  if(reference.phase!=='streaming' && block.phase==='streaming')throw Error('Closed block cannot reopen.');
  const content=value.content;
  if(typeof content!=='string' || utf8Bytes(content)!==block.bytes || await textDigest(content)!==block.prefixDigest || new TextDecoder().decode(encoder.encode(content))!==content || content.includes('\0')) throw Error('Block snapshot failed byte/digest verification.');
  const draft:DraftBlock={...block,type:'assistant-stream',text:'',fromBytes:block.bytes,content,streamId:block.id};
  return Object.freeze({taskId:block.taskId,attemptId:block.attemptId,cursor:block.lastSequence,totalBytes:block.bytes,blocks:Object.freeze([Object.freeze(draft)]),receipts:Object.freeze({})});
}
