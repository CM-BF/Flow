import { it, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { EventBatch } from '@flow/contracts';
import { EventOutbox } from './outbox.js';

it('continues from the center acknowledged sequence without reusing prior event numbers', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flow-outbox-resume-'));
  const batches: EventBatch[] = [];
  const owner = { attemptId: 'resume-attempt', ownerVersion: 3 };
  try {
    const outbox = new EventOutbox(directory, owner, async batch => { batches.push(batch); }, 42);
    await outbox.emit({ type: 'message', text: 'Recovered external task' });
    await outbox.emit({ type: 'completed', outcome: 'succeeded' });
    await outbox.settle();
    expect(batches.flatMap(batch => batch.events.map(event => event.sequence))).toEqual([43, 44]);
    expect(batches.every(batch => batch.ownerVersion === 3)).toBe(true);
    for (const sequence of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => new EventOutbox(directory, owner, async () => {}, sequence)).toThrow();
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
