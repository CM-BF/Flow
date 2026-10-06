// Import-only readiness check: no createServer invocation, Pool construction, listen, or tasks.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Client } from 'pg';
import { createServer } from '../../apps/server/src/index.js';
const dependency = createRequire(new URL('../../../../Flow/package.json', import.meta.url));
assert.equal(typeof createServer, 'function');
assert.equal(Client, dependency('pg').Client);
console.log(JSON.stringify({ productFactoryImported: true, pgClientIdentity: true, resourcesOpened: 0, kind: 'import-only, no PG or HTTP workload' }));
