import assert from 'node:assert/strict';
import { main } from './host-entry.mjs';
import { setupFixture } from './host-fixture.mjs';
import { defaultSequence, cleanupDefault } from './default-host.mjs';
for (const value of [main, setupFixture, defaultSequence, cleanupDefault]) assert.equal(typeof value, 'function');
await assert.rejects(main(['--invalid', '/never-read']));
console.log(JSON.stringify({ actualNodeImports: 4, invalidEntryRejectedBeforeIO: true, pg: 0, services: 0, provider: 0 }));
