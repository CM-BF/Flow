import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rehearse } from './driver.mjs';
import { experimentStop } from './phase-host.mjs';

test('public staged zero-query journey preserves actual proposal, two dependent children and separate acceptance', { timeout: 120000 }, async () => {
  assert.equal(process.env.FLOW_O16_PG_WINDOW, 'approved-one-shot', 'Explicit exclusive PG window required; do not run this test in the pure group.');
  const stop = () => { process.env.FLOW_O16_STOPPED = '1'; experimentStop.abort(); }; process.once('SIGTERM', stop); process.once('SIGINT', stop);
  const run = process.env.FLOW_O16_RUN; assert(/^rehearsal-[a-f0-9-]{36}$/.test(run ?? ''), 'Use the reserved operator entry.'); console.info(JSON.stringify({ o16Run: run, nativeQueries: 0 }));
  try {
    const result = await rehearse(run);
    assert.equal(result.outcome, 'independently-accepted'); assert.equal(result.mode, 'rehearsal');
    assert.equal(result.nativeQueryCalls, 0); assert.equal(result.nativeStageConclusion, 'not-run');
    assert.equal(result.resources.databaseDropped, true); assert.equal(result.resources.directoryRemoved, true);
    assert.deepEqual(result.resources.errors, []);
  } finally { process.off('SIGTERM', stop); process.off('SIGINT', stop); }
});
