import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import net from 'node:net';
import { syncBuiltinESMExports } from 'node:module';

let spawns = 0, listeners = 0;
childProcess.spawn = () => { spawns++; throw Error('Unexpected real spawn'); };
net.createServer = () => { listeners++; throw Error('Unexpected real listener'); };
syncBuiltinESMExports();
const { inspectSystemConfiguration } = await import('./system-config-gate.mjs');
const { configurationBlocked, prepareDelivery } = await import('./execute-reviewed.mjs');
const absent = ['/etc/codex', '/private/etc/codex',
  '/etc/codex/requirements.toml', '/etc/codex/config.toml', '/etc/codex/managed_config.toml',
  '/private/etc/codex/requirements.toml', '/private/etc/codex/config.toml', '/private/etc/codex/managed_config.toml'];
function fixture({ present, errorCode, changeParent = false, link = 'private/etc', mode = 0o755n } = {}) {
  let absentCalls = 0, contentReads = 0;
  const parentIds = new Map([['/etc', 1152921500312571429n], ['/private', 113129833n], ['/private/etc', 113129834n]]);
  return {
    io: {
      lstatSync(file, options) {
        assert.equal(options.bigint, true);
        if (parentIds.has(file)) return { dev: 16777234n,
          ino: parentIds.get(file) + (changeParent && absentCalls === 8 ? 1n : 0n), mode,
          isDirectory: () => file !== '/etc', isSymbolicLink: () => file === '/etc' };
        assert.ok(absent.includes(file)); absentCalls++;
        if (file === present) return { isSymbolicLink: () => true };
        throw Object.assign(Error('fixture'), { code: errorCode ?? 'ENOENT' });
      },
      readlinkSync(file) { assert.equal(file, '/etc'); return link; },
      readFileSync() { contentReads++; throw Error('System content must not be read'); },
    },
    counts: () => ({ absentCalls, contentReads }),
  };
}
let passed = 0;
function check(run) { run(); passed++; }
check(() => {
  const f = fixture(); const result = inspectSystemConfiguration(f.io);
  assert.equal(result.passed, true); assert.equal(result.state, 'ABSENT');
  assert.equal(result.absentCount, 8); assert.equal(result.parentSamples, 2);
  assert.equal(result.raceFree, false); assert.equal(f.counts().contentReads, 0);
});
check(() => {
  for (const present of absent) {
    const f = fixture({ present }); const result = inspectSystemConfiguration(f.io);
    assert.equal(result.passed, false); assert.equal(result.state, 'PRESENT');
    assert.equal(result.obstruction, present); assert.equal(f.counts().contentReads, 0);
  }
});
check(() => {
  for (const errorCode of ['EPERM', 'EACCES', 'ENOTDIR', 'UNLISTED']) {
    const result = inspectSystemConfiguration(fixture({ errorCode }).io);
    assert.equal(result.passed, false); assert.equal(result.state, 'UNKNOWN');
    assert.equal(result.code, errorCode === 'UNLISTED' ? 'UNKNOWN' : errorCode);
  }
});
check(() => {
  const result = inspectSystemConfiguration(fixture({ changeParent: true }).io);
  assert.equal(result.passed, false); assert.equal(result.state, 'PARENT_CHANGED');
  assert.equal(result.absentCount, 8); assert.equal(result.parentSamples, 1);
});
check(() => {
  for (const options of [{ link: 'unexpected' }, { mode: 0o777n }]) {
    const f = fixture(options); const result = inspectSystemConfiguration(f.io);
    assert.equal(result.passed, false); assert.equal(result.state, 'PARENT_CHANGED');
    assert.equal(f.counts().absentCalls, 0);
  }
});
check(() => {
  const gate = inspectSystemConfiguration(fixture({ present: absent[0] }).io);
  const artifact = { owned: true, identity: { dev: 1, ino: 2 }, bytes: 17, closed: true, flushed: true };
  const result = configurationBlocked(gate, 160750, artifact);
  assert.equal(result.targetCalls, 0); assert.equal(result.modelListCalls, 0);
  assert.equal(result.entryReservation, artifact); assert.equal(result.systemConfigurationGate, gate);
  assert.equal(result.resultPersisted, false); assert.equal(prepareDelivery(result, 0).passes, false);
});
assert.equal(spawns, 0); assert.equal(listeners, 0);
process.stdout.write(`${JSON.stringify({ selected: 6, passed, spawns, listeners, realSystemContentReads: 0, fixtures: 'in-memory only' })}\n`);
