import { readBoundedJson } from './response-json.js';
import {
  nativeActivityBodyDescriptorSchema, nativeActivityBodyPageSchema, nativeActivityBodySupportSchema,
  NATIVE_ACTIVITY_BODY_LIMITS as limits,
  type NativeActivityBodyDescriptor, type NativeActivityBodySupport,
} from '../../contracts/src/native-activity-body.js';

export const NATIVE_BODY_RESPONSE_BYTES = Object.freeze({ descriptor: 8192, page: 384 * 1024 });

/** The existing authenticated client transport must enforce maxBytes before JSON parsing. */
export type NativeBodyRequest = (path: string, options: { signal?: AbortSignal; maxBytes: number }) => Promise<unknown>;

export async function readNativeActivityBody(request: NativeBodyRequest, taskId: string, activityId: string, signal?: AbortSignal): Promise<NativeActivityBodyDescriptor> {
  signal?.throwIfAborted();
  const value = nativeActivityBodyDescriptorSchema.parse(await request(bodyPath(taskId, activityId), { signal, maxBytes: NATIVE_BODY_RESPONSE_BYTES.descriptor }));
  signal?.throwIfAborted();
  if (value.taskId !== taskId || value.activityId !== activityId) throw new Error('Material identity does not match the request.');
  return value;
}

export async function readNativeActivityBodySupport(request: NativeBodyRequest, signal?: AbortSignal): Promise<NativeActivityBodySupport> {
  signal?.throwIfAborted();
  const value = nativeActivityBodySupportSchema.parse(await request('/api/runner/native-activity-body-support', { signal, maxBytes: NATIVE_BODY_RESPONSE_BYTES.descriptor }));
  signal?.throwIfAborted();
  return value;
}

export interface VerifiedNativeActivityBodyPage {
  descriptor: NativeActivityBodyDescriptor;
  chunks: Uint8Array[];
  nextIndex: number;
  hasMore: boolean;
  /** Chunk integrity is not evidence that the entire material is complete. */
  integrity: 'partial' | 'complete';
}

/** A single material, one admitted read at a time, no prefetch or timer. */
export class NativeActivityBodyReader {
  private descriptor: NativeActivityBodyDescriptor;
  private content: Uint8Array<ArrayBuffer>;
  private nextIndex = 0;
  private offset = 0;
  private complete = false;
  private inFlight = false;
  private text: string | undefined;
  private readonly lifetime = new AbortController();

  constructor(private readonly request: NativeBodyRequest, descriptor: NativeActivityBodyDescriptor) {
    this.descriptor = nativeActivityBodyDescriptorSchema.parse(descriptor);
    this.content = new Uint8Array(this.descriptor.bytes ?? 0);
  }

  async readNext(signal?: AbortSignal): Promise<VerifiedNativeActivityBodyPage> {
    if (this.inFlight) throw new Error('A material page read is already in flight.');
    const readSignal = signal ? AbortSignal.any([signal, this.lifetime.signal]) : this.lifetime.signal;
    readSignal.throwIfAborted();
    if (this.complete || this.descriptor.state === 'legacy') return this.result([], false);
    this.inFlight = true;
    const committedOffset = this.offset;
    let writtenUntil = committedOffset;
    try {
      const path = `${bodyPath(this.descriptor.taskId, this.descriptor.activityId)}/chunks?afterIndex=${this.nextIndex}&limit=${limits.pageChunks}`;
      const page = nativeActivityBodyPageSchema.parse(await this.request(path, { signal: readSignal, maxBytes: NATIVE_BODY_RESPONSE_BYTES.page }));
      readSignal.throwIfAborted();
      assertProgress(this.descriptor, page.descriptor);
      const count = Math.min(limits.pageChunks, page.descriptor.receivedChunks - this.nextIndex);
      if (count < 0 || page.chunks.length !== count || page.nextIndex !== this.nextIndex + count
        || page.hasMore !== (page.nextIndex < page.descriptor.receivedChunks)) throw new Error('Material cursor is inconsistent.');
      const decoded: Uint8Array<ArrayBuffer>[] = [];
      let offset = committedOffset;
      for (const [index, chunk] of page.chunks.entries()) {
        const expectedBytes = Math.min(limits.chunkBytes, this.content.length - offset);
        if (chunk.index !== this.nextIndex + index || chunk.offset !== offset || chunk.bytes !== expectedBytes) throw new Error('Material chunks are not contiguous.');
        const binary = atob(chunk.base64);
        if (binary.length !== chunk.bytes || btoa(binary) !== chunk.base64) throw new Error('Material base64 is not canonical.');
        const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
        if (await sha256(bytes) !== chunk.sha256) throw new Error('Material chunk digest does not match.');
        readSignal.throwIfAborted();
        decoded.push(bytes); offset += bytes.length;
      }
      // Uncommitted tail is private and cannot change the already verified prefix.
      for (const bytes of decoded) { this.content.set(bytes, writtenUntil); writtenUntil += bytes.length; }
      const complete = page.descriptor.state === 'complete' && page.nextIndex === page.descriptor.chunkCount;
      if (complete && (offset !== this.content.length || await sha256(this.content) !== page.descriptor.sha256)) throw new Error('Complete material digest does not match.');
      readSignal.throwIfAborted();
      this.offset = offset; this.nextIndex = page.nextIndex;
      this.descriptor = page.descriptor; this.complete = complete;
      return this.result(decoded, page.hasMore);
    } catch (error) {
      this.content.fill(0, committedOffset, writtenUntil);
      throw error;
    } finally { this.inFlight = false; }
  }

  /** Decode once, only after full length/digest verification; pages are not standalone JSON. */
  completeText(): string {
    this.lifetime.signal.throwIfAborted();
    if (!this.complete) throw new Error('The complete material is not verified.');
    return this.text ??= new TextDecoder('utf-8', { fatal: true }).decode(this.content);
  }

  close(): void {
    this.lifetime.abort();
    this.content = new Uint8Array(0); this.text = undefined;
  }

  private result(chunks: Uint8Array[], hasMore: boolean): VerifiedNativeActivityBodyPage {
    return { descriptor: { ...this.descriptor }, chunks: chunks.map(chunk => chunk.slice()), nextIndex: this.nextIndex,
      hasMore, integrity: this.complete ? 'complete' : 'partial' };
  }
}

function bodyPath(taskId: string, activityId: string) {
  return `/api/tasks/${encodeURIComponent(taskId)}/native-activities/${encodeURIComponent(activityId)}/body`;
}

function assertProgress(previous: NativeActivityBodyDescriptor, next: NativeActivityBodyDescriptor) {
  const immutable = ['taskId', 'attemptId', 'activityId', 'protocol', 'representation', 'mediaType', 'bytes', 'sha256', 'chunkCount'] as const;
  if (immutable.some(key => previous[key] !== next[key]) || next.receivedBytes < previous.receivedBytes || next.receivedChunks < previous.receivedChunks
    || previous.state !== 'receiving' && previous.state !== next.state || next.state === 'legacy') throw new Error('Material identity or progress changed.');
}

async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Material policy stays narrower than the shared JSON decoder. */
export async function readBoundedNativeBodyJson(response: Response, maxBytes: number, signal?: AbortSignal): Promise<unknown> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > NATIVE_BODY_RESPONSE_BYTES.page) throw new Error('Invalid material response bound.');
  return readBoundedJson(response, maxBytes, signal, 'Material response');
}
