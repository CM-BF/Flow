import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { assistantStreamProtocol } from '../../../../packages/contracts/src/assistant-stream.js';
import type { TimelineEntry } from '@flow/contracts';

/** Filter only at public legacy reads; callers calculate cursors from unfiltered rows. */
export function legacyTimelineEntries<T>(entries: readonly T[], entryOf: (item: T) => TimelineEntry): T[] {
  return entries.filter(item => {
    const entry = entryOf(item);
    return entry.kind !== 'reference' || entry.reference.stream?.kind !== 'assistant-stream';
  });
}

export interface ConversationReadOptions {
  /** Enable negotiation only after mounting the task-bound patch-v1 read routes. */
  assistantStreamReadable?: boolean;
}

export async function negotiatedAssistantStream(app: FastifyInstance, pool: Pool, rawHeaders: readonly string[], options: ConversationReadOptions): Promise<boolean> {
  if (options.assistantStreamReadable !== true || assistantStreamProtocol(rawHeaders) === null) return false;
  const routes = ['/api/tasks/:id/assistant-stream', '/api/tasks/:id/assistant-stream/patches', '/api/tasks/:id/assistant-stream/:blockId'];
  if (!routes.every(url => app.hasRoute({ method: 'GET', url }))) return false;
  try {
    // Bounded readiness probe verifies the migration and SELECT access, without reading bodies.
    const result = await pool.query<{ ready: boolean }>(`SELECT EXISTS(SELECT 1 FROM flow.migrations WHERE version=22) AS ready,
      (SELECT count(*) FROM flow.assistant_stream_blocks WHERE false) AS blocks,
      (SELECT count(*) FROM flow.assistant_stream_patches WHERE false) AS patches,
      (SELECT count(*) FROM flow.assistant_stream_settlements WHERE false) AS settlements`);
    return result.rows[0]?.ready === true;
  } catch (error) {
    if (['42P01', '42501'].includes((error as { code?: string }).code ?? '')) return false;
    throw error;
  }
}
