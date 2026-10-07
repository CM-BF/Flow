import { describe, expect, it } from 'vitest';
import { createStartupProgress, STARTUP_MIGRATIONS, STARTUP_PROGRESS_LIMITS, STARTUP_PROGRESS_PREFIX, withStartupPhase } from './startup-progress.js';

function capture(now = () => 0) {
  const lines: string[] = [];
  const progress = createStartupProgress({ enabled: true, now, write: line => { lines.push(line); } });
  return { ...progress, lines, frames: () => lines.map(line => JSON.parse(line.slice(STARTUP_PROGRESS_PREFIX.length))) };
}

describe('bounded startup progress', () => {
  it('fits all 31 fixed migrations and normal initialization inside both limits', async () => {
    let time = 0;
    const stream = capture(() => time += 117);
    stream.observe({ phase: 'main', event: 'point' });
    for (const phase of ['configuration', ...STARTUP_MIGRATIONS, 'authentication', 'cors', 'scheduler', 'routes', 'ready-conversation', 'ready-goal', 'listen'] as const) {
      await withStartupPhase(stream.observe, phase, () => undefined);
    }
    const result = stream.finish('listening');
    expect(STARTUP_MIGRATIONS).toHaveLength(31);
    expect(result.state).toBe('complete');
    expect(result.frames).toBe(80);
    expect(result.bytes).toBe(Buffer.byteLength(stream.lines.join('')));
    expect(result.bytes).toBeLessThanOrEqual(8192);
    const frames = stream.frames();
    expect(frames.map(frame => frame.s)).toEqual(Array.from({ length: 80 }, (_, i) => i + 1));
    expect(frames.every((frame, i) => i === 0 || frame.ms >= frames[i - 1].ms)).toBe(true);
    expect(frames.at(-1)).toMatchObject({ e: 'complete', outcome: 'listening' });
  });

  it('does no observation work when disabled or absent', async () => {
    const progress = createStartupProgress({ enabled: false, now: () => { throw Error('clock called'); }, write: () => { throw Error('writer called'); } });
    expect(await withStartupPhase(progress.observe, 'configuration', () => 42)).toBe(42);
    expect(await withStartupPhase(undefined, 'configuration', () => 43)).toBe(43);
    expect(progress.finish('listening')).toEqual({ state: 'disabled', frames: 0, bytes: 0 });
  });

  it('records only bounded structural error fields and rethrows the original value', async () => {
    const stream = capture();
    const error = Object.assign(Error('private SQL and token'), { name: 'DatabaseError', code: '42P01', detail: 'secret' });
    await expect(withStartupPhase(stream.observe, 'migrate', () => { throw error; })).rejects.toBe(error);
    expect(stream.finish('failed').state).toBe('complete');
    expect(stream.frames()[1]).toEqual({ v: 1, s: 2, ms: 0, p: 'migrate', e: 'error', n: 'DatabaseError', c: '42P01' });
    expect(stream.lines.join('')).not.toMatch(/private|token|secret|detail|stack|message/);
  });

  it('keeps untrusted error names, codes and throwing accessors unknown', async () => {
    for (const error of [{ name: 'private-name', code: 'private-code' }, { get name() { throw Error('private'); } }]) {
      const stream = capture();
      await expect(withStartupPhase(stream.observe, 'scheduler', () => Promise.reject(error))).rejects.toBe(error);
      expect(stream.frames()[1]).toMatchObject({ n: 'Unknown', c: null });
    }
  });

  it('reserves an explicit incomplete footer at the frame limit and stops', () => {
    const stream = capture();
    for (let i = 0; i < 200; i++) stream.observe({ phase: 'main', event: 'point' });
    const result = stream.finish('listening');
    expect(result).toMatchObject({ state: 'incomplete', reason: 'frame-limit', frames: 128 });
    expect(stream.frames().at(-1)).toMatchObject({ e: 'incomplete', why: 'frame-limit' });
    expect(result.bytes).toBeLessThanOrEqual(STARTUP_PROGRESS_LIMITS.bytes);
  });

  it('reserves an explicit incomplete footer at the byte limit and stops', () => {
    const stream = capture();
    for (let i = 0; i < 200; i++) stream.observe({ phase: 'migrateContextObservationHistory', event: 'point' });
    const result = stream.finish('listening');
    expect(result).toMatchObject({ state: 'incomplete', reason: 'byte-limit' });
    expect(stream.frames().at(-1)).toMatchObject({ e: 'incomplete', why: 'byte-limit' });
    expect(result.bytes).toBeLessThanOrEqual(8192);
    expect(result.frames).toBeLessThanOrEqual(128);
  });

  it('stops on write failure and backpressure without retry or a success footer', async () => {
    for (const failure of ['throw', 'backpressure']) {
      let writes = 0, operations = 0;
      const stream = createStartupProgress({ enabled: true, write: () => { writes++; if (failure === 'throw') throw Error('sink'); return false; } });
      expect(await withStartupPhase(stream.observe, 'listen', () => ++operations)).toBe(1);
      expect(stream.finish('listening')).toMatchObject({ state: 'incomplete', reason: failure === 'throw' ? 'write-error' : 'backpressure', frames: 1 });
      expect(writes).toBe(1);
    }
  });

  it('treats unfinished phases and malformed event ordering as incomplete', () => {
    const open = capture();
    open.observe({ phase: 'migrate', event: 'enter' });
    expect(open.finish('failed')).toMatchObject({ state: 'incomplete', reason: 'phase-open' });
    const malformed = capture();
    malformed.observe({ phase: 'migrate', event: 'settled' });
    expect(malformed.finish('listening')).toMatchObject({ state: 'incomplete', reason: 'invalid-event' });
    const unknown = capture();
    Reflect.apply(unknown.observe, undefined, [{ phase: 'secret', event: 'point' }]);
    expect(unknown.finish('failed')).toMatchObject({ state: 'incomplete', reason: 'invalid-event' });
    expect(unknown.lines.join('')).not.toContain('secret');
  });

  it('makes invalid or sub-millisecond backwards clock observations incomplete', () => {
    for (const times of [[10, 9.9], [0, NaN], [0, Infinity]]) {
      const stream = capture(() => times.shift()!);
      stream.observe({ phase: 'main', event: 'point' });
      stream.observe({ phase: 'main', event: 'point' });
      expect(stream.finish('failed')).toMatchObject({ state: 'incomplete', reason: 'clock-invalid' });
    }
  });

  it('does not fabricate elapsed time while the awaited operation remains pending', async () => {
    const stream = capture();
    let release!: () => void;
    const pending = withStartupPhase(stream.observe, 'migrate', () => new Promise<void>(resolve => { release = resolve; }));
    expect(stream.frames().map(frame => frame.e)).toEqual(['enter']);
    release(); await pending;
    expect(stream.frames().map(frame => frame.e)).toEqual(['enter', 'settled']);
  });
});
