import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, readFile, rmdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { HarnessAdapter, HarnessContext, RunnerEventData } from '@flow/contracts';
import { FixtureObservation, observeFixtureAdapter } from './fixture-observation.js';
import { CancelJourney } from './fixture.js';

const executionIdentity = { taskId: '11111111-1111-4111-8111-111111111111', attemptId: '22222222-2222-4222-8222-222222222222',
  runnerId: '33333333-3333-4333-8333-333333333333', ownerVersion: 2 };
function context(overrides: Partial<HarnessContext> = {}): HarnessContext {
  return { task: {} as HarnessContext['task'], workingDirectory: '/unused', signal: new AbortController().signal,
    executionIdentity, emit: async () => {}, assertOwnership: async () => {}, ...overrides } as HarnessContext;
}
function adapter(run: HarnessAdapter['run']): HarnessAdapter { return { name: 'claude', version: 'synthetic', run }; }
function event(type: string) { return { type, content: 'secret body must never be observed' } as RunnerEventData; }

for (const phase of ['session', 'assistant-final', 'artifact', 'verification']) {
  test(`[fixture observation] ${phase} rejection preserves the original error and exact stage`, async () => {
    const observations = new FixtureObservation();
    const primary = Object.assign(Error('secret response body'), { name: 'FlowApiError', code: 'assistant_source_mismatch', status: 409 });
    const wrapped = observeFixtureAdapter(adapter(c => c.emit(event(phase))), observations);
    await assert.rejects(wrapped.run(context({ emit: async () => { throw primary; } })), error => error === primary);
    const frames = observations.snapshot().frames;
    assert.deepEqual(frames.map(({ phase, state }) => [phase, state]), [
      ['adapter', 'start'], [phase, 'start'], [phase, 'failed'], ['adapter', 'failed'],
    ]);
    assert.deepEqual(frames[2]!.error, { name: 'FlowApiError', code: 'assistant_source_mismatch', status: 409 });
    assert.deepEqual(frames[2]!.identity, executionIdentity);
    assert.ok(!JSON.stringify(frames).includes('secret'));
  });
}

test('[fixture observation] ownership failure prevents later emits without changing the rejection', async () => {
  const observations = new FixtureObservation(), primary = Object.assign(Error('private'), { code: 'ownership_lost' });
  let emissions = 0;
  const wrapped = observeFixtureAdapter(adapter(async c => { await c.assertOwnership(); await c.emit(event('artifact')); }), observations);
  await assert.rejects(wrapped.run(context({ assertOwnership: async () => { throw primary; }, emit: async () => { emissions++; } })), error => error === primary);
  assert.equal(emissions, 0);
  assert.equal(observations.snapshot().frames.find(frame => frame.phase === 'ownership' && frame.state === 'failed')?.error?.code, 'ownership_lost');
});

test('[fixture observation] success preserves call order and does not attest runtime completion', async () => {
  const observations = new FixtureObservation(), calls: string[] = [];
  const wrapped = observeFixtureAdapter(adapter(async c => {
    await c.emit(event('session')); await c.assertOwnership();
    await c.emit(event('assistant-final')); await c.emit(event('artifact')); await c.emit(event('verification'));
  }), observations);
  await wrapped.run(context({ emit: async data => { calls.push(data.type); }, assertOwnership: async () => { calls.push('ownership'); } }));
  assert.deepEqual(calls, ['session', 'ownership', 'assistant-final', 'artifact', 'verification']);
  const snapshot = observations.snapshot();
  assert.equal(snapshot.frames.at(-1)?.state, 'settled');
  assert.equal(snapshot.runtimeFinalization, 'NOT_OBSERVED');
  assert.equal(snapshot.incomplete, false);
  assert.deepEqual(snapshot.frames.map(frame => frame.sequence), Array.from({ length: 12 }, (_, i) => i + 1));
  assert.ok(snapshot.frames.every((frame, i) => frame.elapsedMs >= 0 && (!i || frame.elapsedMs >= snapshot.frames[i - 1]!.elapsedMs)));
});

test('[fixture observation] unknown fields and fetch cause are safe without serializing private data', async () => {
  const observations = new FixtureObservation();
  const primary = { name: 'private-name', code: 'private-code', status: 'private-status', message: 'secret',
    cause: { code: 'ECONNREFUSED', token: 'secret' }, toJSON() { throw Error('must not serialize original'); } };
  await assert.rejects(observations.run('ownership', { taskId: 'private' }, async () => { throw primary; }), error => error === primary);
  const frame = observations.snapshot().frames.at(-1)!;
  assert.deepEqual(frame.error, { name: null, code: 'ECONNREFUSED', status: null });
  assert.deepEqual(frame.identity, { taskId: null, attemptId: null, runnerId: null, ownerVersion: null });
  assert.ok(!JSON.stringify(frame).match(/private|secret/));
});

test('[fixture observation] hostile diagnostic fields do not replace primary errors or success values', async () => {
  const observations = new FixtureObservation(), hostile = new Proxy({}, { get() { throw Error('diagnostic getter'); } });
  await assert.rejects(observations.run('artifact', hostile, async () => { throw hostile; }), error => error === hostile);
  assert.deepEqual(observations.snapshot().frames.at(-1)?.error, { name: null, code: null, status: null });
  const value = {};
  assert.equal(await observations.run('artifact', hostile, async () => value), value);
});

test('[fixture observation] saturation is explicit and never suppresses later operations', async () => {
  const observations = new FixtureObservation(); let called = 0;
  for (let i = 0; i < 80; i++) await observations.run('artifact', executionIdentity, async () => { called++; });
  const snapshot = observations.snapshot();
  assert.equal(called, 80); assert.equal(snapshot.frames.length, 64); assert.equal(snapshot.incomplete, true);
  assert.ok(Buffer.byteLength(JSON.stringify(snapshot)) <= snapshot.maximumBytes);
  snapshot.frames[0]!.identity.taskId = 'changed-copy';
  assert.equal(observations.snapshot().frames[0]!.identity.taskId, executionIdentity.taskId);
});

test('[fixture observation] runner notices remain distinct and unknown values stay unknown', () => {
  const observations = new FixtureObservation();
  observations.notice({ type: 'events-retained', attemptId: executionIdentity.attemptId, token: 'secret' });
  observations.notice({ type: 'secret', attemptId: 'secret' });
  assert.deepEqual(observations.snapshot().frames.map(frame => [frame.phase, frame.state, frame.notice, frame.identity.attemptId]),
    [['runtime', 'notice', 'events-retained', executionIdentity.attemptId], ['runtime', 'notice', null, null]]);
  assert.ok(!JSON.stringify(observations.snapshot()).includes('secret'));
});

test('[fixture observation] pending barrier and its rejection remain visible without a new timer', async () => {
  const observations = new FixtureObservation(); let reject!: (error: Error) => void;
  const primary = Error('cancelled synthetic barrier');
  const pending = observations.run('barrier', executionIdentity, () => new Promise<void>((_, fail) => { reject = fail; }));
  assert.equal(observations.snapshot().frames.at(-1)?.state, 'start');
  reject(primary); await assert.rejects(pending, error => error === primary);
  assert.equal(observations.snapshot().frames.at(-1)?.state, 'failed');
});

test('[fixture observation] actual fixture save persists bounded evidence and keeps exclusive write failure', async () => {
  const scratch = process.env.TUI_OBSERVATION_SCRATCH;
  assert.ok(scratch, 'explicit owned scratch required');
  const directory = join(scratch, 'save-fixture'); await mkdir(directory, { mode: 0o700 });
  const fixture = new CancelJourney(directory);
  try {
    await fixture.save('handoff-stages.json', { workFailure: { stage: 'web-b-final', code: null } });
    const before = await readFile(join(directory, 'handoff-stages.json'), 'utf8');
    assert.equal(JSON.parse(before).fixtureObservation.runtimeFinalization, 'NOT_OBSERVED');
    await assert.rejects(fixture.save('handoff-stages.json', {}), { code: 'EEXIST' });
    assert.equal(await readFile(join(directory, 'handoff-stages.json'), 'utf8'), before);
  } finally { await unlink(join(directory, 'handoff-stages.json')); await rmdir(directory); }
});
