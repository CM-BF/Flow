// Only imports local work definitions and checks pre-I/O parameter rejection.
import assert from 'node:assert/strict';
import { validateHostInput, runHostConsumer } from './host-consumer.mjs';
import { runMixedConsumer } from './mixed-runner.mjs';
assert.equal(typeof runMixedConsumer, 'function');
let touched = false;
await assert.rejects(runHostConsumer({ input: {}, pool: { query() { touched = true; throw new Error('Unexpected database operation'); } } }), { code: 'HOST_FIXED_INPUT_REQUIRED' });
assert.equal(touched, false);
const base = { format: 1, directory: '/private/tmp/flow-svc09a-host-prepare', sourceHead: 'a'.repeat(40),
  repository: '/fixture/source', artifact: { artifactId: 'b'.repeat(64), manifestDigest: 'b'.repeat(64), sourceHead: 'a'.repeat(40) }, choices: [{}, {}] };
assert.throws(() => validateHostInput({ ...base, directory: '/Users/citrine/private' }), { code: 'HOST_FIXED_INPUT_REQUIRED' });
assert.throws(() => validateHostInput({ ...base, artifact: { ...base.artifact, sourceHead: 'c'.repeat(40) } }), { code: 'HOST_FIXED_INPUT_REQUIRED' });
assert.equal(validateHostInput(base), `${base.directory}/backend-artifacts/${base.artifact.artifactId}/root`);
console.log(JSON.stringify({ checks: 3, passed: 3, meaning: 'definition import; missing fixed input; private path and source mismatch rejection', productImports: 0, sockets: 0, PG: 0, native: 0, provider: 0, semanticHostValidation: 'NOT_RUN' }));
