import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregate } from '../../../apps/execution-dashboard/src/aggregate.mjs';
import { fixture, now } from '../../../apps/execution-dashboard/test/fixture.mjs';
test('actual aggregate consumes high precision UTC and isolates a malformed primary timestamp', { timeout: 6000 }, async context => {
 const f = await fixture(context); const [a,b] = f.tasks;
 await f.writeStatus(a, { updated: '2026-10-06T01:59:59.123456789+00:00' });
 let value = await aggregate(f.registry, now); let task = value.tasks.find(t=>t.id===a.id);
 assert.equal(task.status.updatedAt, '2026-10-06T01:59:59.123Z');
 assert.equal(task.source.stale,false); assert.equal(task.current,true);
 assert.equal(task.source.ageHours,877/3600000);
 await f.writeStatus(a, { updated: '2026/10/06 01:59 UTC / main sync 2026-10-06 01:59 UTC' });
 value = await aggregate(f.registry,now); task=value.tasks.find(t=>t.id===a.id);
 assert.equal(task.status.updatedAt,null); assert.equal(task.source.stale,true); assert.equal(task.current,false);
 assert.equal(value.tasks.find(t=>t.id===b.id).current,true);
 console.log(JSON.stringify({ highPrecision: 'current', malformedPrimary:'unknown-stale', independentTask:'current', tasks:value.tasks.length }));
});
