import { createHash } from 'node:crypto';
import { ASSISTANT_ATTEMPT_BYTES, ASSISTANT_PATCH_BYTES, ASSISTANT_FLUSH_MS, assistantStreamIdentity, type AssistantStreamData } from '../../../../../packages/contracts/src/assistant-stream.js';
import { createPatchBuffer, sealPatches, type PatchBuffer } from '../../assistant-stream/patch-buffer.js';
import type { CodexStreamDelta } from './evidence.js';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
type Block = { key: string; header: Pick<AssistantStreamData, 'nativeSessionId' | 'nativeMessageId' | 'nativeTurnId' | 'channel' | 'blockIndex'>; buffer: PatchBuffer; bytes: number; flushAt: number };
/** Maps only validated observations; the shared buffer owns UTF-8 offsets/revisions/prefix hashes. */
export class CodexAssistantStream {
  private readonly blocks = new Map<string, Block>();
  private bytes = 0;
  private patches = 0;
  private identity: string | undefined;
  constructor(private readonly now: () => number = () => performance.now()) {}
  accept(value: CodexStreamDelta): AssistantStreamData[] {
    const identity = JSON.stringify([value.threadId, value.turnId]);
    if (this.identity !== undefined && this.identity !== identity) throw new Error('Codex stream changed turn.');
    this.identity = identity;
    const header = { nativeSessionId: value.threadId, nativeMessageId: value.itemId, nativeTurnId: value.turnId,
      channel: value.kind, blockIndex: value.index ?? 0 };
    const key = assistantStreamIdentity({ ...header, source: 'codex.app-server.stream' });
    let block = this.blocks.get(key);
    if (!block) {
      if (value.completedText !== undefined || this.blocks.size >= 256) throw new Error('Unbound or excess stream block.');
      block = { key, header, buffer: createPatchBuffer(), bytes: 0, flushAt: 0 }; this.blocks.set(key, block);
    }
    const buffer = block.buffer;
    if (buffer.phase !== 'streaming') throw new Error('Codex stream block already completed.');
    if (value.completedText !== undefined) {
      if (value.completedText !== buffer.content) throw new Error('Codex stream differs from its completed item.');
      buffer.phase = 'block-complete'; buffer.dirty = true;
    } else {
      if (value.delta.includes('\0') || Buffer.from(value.delta).toString('utf8') !== value.delta) throw new Error('Invalid stream text.');
      const added = Buffer.byteLength(value.delta);
      if (this.bytes + added > ASSISTANT_ATTEMPT_BYTES) throw new Error('Stream attempt byte limit.');
      this.bytes += added; block.bytes += added; buffer.content += value.delta; buffer.dirty ||= added > 0;
    }
    // First text is immediate; the exchange wakes the same pump when a dirty prefix is due.
    const now = this.now();
    if (value.completedText === undefined && buffer.revision > 0 && block.bytes - buffer.sentBytes < ASSISTANT_PATCH_BYTES && now < block.flushAt) return [];
    return this.seal(block, now);
  }
  flushDelayMs(): number | null {
    let due = Infinity;
    for (const block of this.blocks.values()) if (block.buffer.dirty && block.buffer.phase === 'streaming') due = Math.min(due, block.flushAt);
    return due === Infinity ? null : Math.max(0, due - this.now());
  }
  flushDue(): AssistantStreamData[] {
    const now = this.now(), patches: AssistantStreamData[] = [];
    for (const block of this.blocks.values()) {
      if (block.buffer.dirty && block.buffer.phase === 'streaming' && block.flushAt <= now) patches.push(...this.seal(block, now));
    }
    return patches;
  }
  private seal(block: Block, now: number): AssistantStreamData[] {
    const { key, header, buffer } = block;
    const patches = sealPatches(buffer, revision => ({ type: 'assistant-stream', ...header, parentToolUseId: null,
      source: 'codex.app-server.stream', streamId: hash(key),
      // Generated correlation, not a claimed native notification UUID (0.154 provides none).
      sourceMessageId: hash(JSON.stringify([key, revision])) }));
    if (patches.length) block.flushAt = now + ASSISTANT_FLUSH_MS;
    this.patches += patches.length;
    if (this.patches > 4096) throw new Error('Stream attempt patch limit.');
    return patches;
  }
}
