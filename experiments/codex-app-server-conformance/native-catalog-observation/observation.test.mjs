import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import childProcess from 'node:child_process';
import net from 'node:net';
import { syncBuiltinESMExports } from 'node:module';
let spawns = 0, listeners = 0;
childProcess.spawn = () => { spawns++; throw Error('No real child'); };
net.createServer = () => { listeners++; throw Error('No listener'); };
syncBuiltinESMExports();
const { inspectOwnedRoots, runNativeCatalogProbe } = await import('./probe.mjs');
const { recordNotification, notificationBounds } = await import('./notifications.mjs');
const { prepareDelivery } = await import('./execute-reviewed.mjs');
const groups = [], fixtures = [];
const summaryState = () => ({ notificationCount: 0, notificationValueBytes: 0,
  notificationSummaries: [], notificationSummaryLimit: false, notificationOverflow: false });
function fakeStat(kind, ino, size = 64, blocks = 0) {
  return { dev: 1, ino, size, blocks, isDirectory: () => kind === 'directory',
    isFile: () => kind === 'file', isSymbolicLink: () => kind === 'link' };
}
function inventoryIO(extraSpecial = false) {
  let enumerations = 0, linkReads = 0;
  const names = ['applypatch', 'apply_patch', 'codex-execve-wrapper'];
  const nodes = new Map([['/own', fakeStat('directory', 1)],
    ...names.map((name, i) => [`/own/${name}`, fakeStat('link', 2 + i, 122)])]);
  if (extraSpecial) { names.push('socket'); nodes.set('/own/socket', fakeStat('special', 9)); }
  return { counts: () => ({ enumerations, linkReads }),
    io: { lstatSync: name => nodes.get(name), readlinkSync() { linkReads++; throw Error('No link reads'); },
      opendirSync(name, options) {
        assert.equal(name, '/own'); assert.deepEqual(options, { bufferSize: 1, recursive: false }); enumerations++;
        let i = 0; return { readSync: () => i < names.length ? { name: names[i++] } : null, closeSync() {} };
      } } };
}
function fixture() {
  const directory = fs.mkdtempSync('/private/tmp/flow-native-observation-fake-');
  const record = { path: directory, identity: null, removed: false }; fixtures.push(record);
  const stat = fs.lstatSync(directory); assert(stat.isDirectory() && !stat.isSymbolicLink());
  record.identity = { dev: stat.dev, ino: stat.ino }; return directory;
}
async function runFake({ links = false, changedControl = null, message = null } = {}) {
  const base = fixture(); const evidence = path.join(base, 'evidence'); fs.mkdirSync(evidence);
  const stderr = Buffer.from('synthetic stderr'); let closed = false, waiter, received = false, requests = 0, originalWrites = 0;
  const outside = path.join(base, 'outside'); fs.mkdirSync(outside);
  const factory = options => {
    const control = path.dirname(options.spawn.args[options.spawn.args.indexOf('-f') + 1]);
    const state = options.spawn.environment.CODEX_HOME;
    if (links) for (const name of ['applypatch', 'apply_patch', 'codex-execve-wrapper']) fs.symlinkSync('/fixed/native', path.join(state, name));
    options.privateStderr.write(stderr);
    return { ready: Promise.resolve({}), snapshot: () => ({ pid: 4242, stderrBytes: stderr.length, ignoredResponses: 0 }),
      request: async () => { requests++; return { data: [], nextCursor: null }; },
      receive: () => {
        if (message && !received) { received = true; return Promise.resolve(message); }
        return closed ? Promise.resolve(null) : new Promise(resolve => { waiter = resolve; });
      },
      close: async () => {
        if (changedControl && !closed) {
          fs.renameSync(control, `${control}-original`);
          if (changedControl === 'link') fs.symlinkSync(outside, control); else fs.mkdirSync(control);
        }
        closed = true; waiter?.(null);
        return { reason: 'CLOSED', child: 'confirmed-exited', exitCode: 0, signal: null, remoteEffects: 'unknown',
          stderrCapture: { observedBytes: stderr.length, writtenBytes: stderr.length, truncated: false,
            observerFailed: false, streamEnded: true, childCloseObserved: true, incomplete: false } };
      } };
  };
  const io = { ...fs, openSync(file, flags, mode) {
    if (String(file).endsWith('/control/stderr.raw')) originalWrites++;
    return fs.openSync(file, flags, mode);
  } };
  const result = await runNativeCatalogProbe({ factory, native: '/fixed/native', policyBytes: Buffer.from('(version 1)'),
    evidenceDirectory: evidence, preparedBytes: 1000 }, { io, rootBase: base, now: () => 100 });
  return { result, requests, originalWrites, outside };
}
try {
  {
    const fixture = inventoryIO();
    const result = inspectOwnedRoots([{ path: '/own', identity: { dev: 1, ino: 1 } }], fixture.io);
    assert.equal(result.complete, true); assert.equal(result.symlinks, 3); assert.equal(result.entries, 4);
    assert.equal(result.logicalBytes, 64 + 3 * 122); assert.equal(result.allocatedBytes, 0);
    assert.deepEqual(fixture.counts(), { enumerations: 1, linkReads: 0 }); groups.push('link-self-bytes-no-follow');
  }
  {
    const fixture = inventoryIO(true);
    const result = inspectOwnedRoots([{ path: '/own', identity: { dev: 1, ino: 1 } }], fixture.io);
    assert.equal(result.complete, false); assert.equal(result.withinLimit, false);
    const unknownRoot = inspectOwnedRoots([{ path: '/own', identity: null }], fixture.io);
    assert.equal(unknownRoot.complete, false); groups.push('unknown-special-and-root');
  }
  {
    for (const [method, expected, continues] of [['configWarning', 'PERMITTED_NAME', true],
      ['thread/started', 'KNOWN_UNEXPECTED', false], ['configWarning/PRIVATE', 'UNKNOWN', false]]) {
      const result = summaryState();
      assert.equal(recordNotification(result, { kind: 'notification', method, params: { details: 'PRIVATE_PAYLOAD' } }), continues);
      const row = result.notificationSummaries[0]; assert.equal(row.classification, expected);
      assert.equal(row.knownMethod, expected === 'UNKNOWN' ? null : method); assert.equal(row.payloadValidated, false);
      assert(!JSON.stringify(result).includes('PRIVATE'));
    }
    groups.push('exact-public-name-separate-from-permission');
  }
  {
    const result = summaryState(); const message = { kind: 'notification', method: 'configWarning', params: null };
    for (let i = 0; i < 8; i++) assert.equal(recordNotification(result, message), true);
    assert.equal(recordNotification(result, message), false); assert.equal(result.notificationSummaries.length, 8);
    assert.equal(result.notificationOverflow, true); assert(Buffer.byteLength(JSON.stringify(result.notificationSummaries)) <= 2048);
    for (const extra of [0, 1]) {
      const state = summaryState(); const m = { kind: 'notification', method: 'configWarning', params: '' };
      m.params = 'x'.repeat(notificationBounds.serializedValueBytes - Buffer.byteLength(JSON.stringify(m)) + extra);
      assert.equal(recordNotification(state, m), extra === 0);
      assert.equal(state.notificationValueBytes, notificationBounds.serializedValueBytes + extra);
    }
    groups.push('count-and-decoded-value-byte-boundaries');
  }
  {
    const { result, requests, originalWrites } = await runFake({ links: true });
    assert.equal(requests, 1); assert.equal(result.status, 'CATALOG_OBSERVED'); assert.equal(originalWrites, 1);
    assert.equal(result.inventories[0].symlinks, 3); assert.equal(result.rootCleanupComplete, true);
    assert.equal(prepareDelivery(result, 110).passes, true); groups.push('fake-three-links-cleanup');
  }
  {
    for (const changedControl of ['link', 'directory']) {
      const { result, originalWrites, outside } = await runFake({ changedControl });
      assert.equal(originalWrites, 0); assert.equal(fs.existsSync(path.join(outside, 'stderr.raw')), false);
      assert.equal(result.failure, 'CONTROL_IDENTITY_UNKNOWN'); assert.equal(result.outputAccountingComplete, false);
      assert.equal(result.rootCleanupComplete, false); assert.equal(result.retainedRoots.length, 2);
      assert.equal(result.retainedDiagnosticArtifact.complete, true); assert.equal(prepareDelivery(result, 110).passes, false);
    }
    groups.push('control-link-or-replacement-no-original-write');
  }
  {
    const { result, requests } = await runFake({ message: { kind: 'notification', method: 'thread/started', params: { private: 'PRIVATE_PAYLOAD' } } });
    assert.equal(requests, 0); assert.equal(result.failure, 'NOTIFICATION_UNKNOWN_OR_LIMIT');
    assert.equal(result.notificationSummaries[0].knownMethod, 'thread/started');
    assert.equal(result.notificationSummaries[0].decision, 'stop'); assert(!JSON.stringify(result).includes('PRIVATE_PAYLOAD'));
    groups.push('real-caller-consumes-finite-metadata-and-stops');
  }
  assert.equal(spawns, 0); assert.equal(listeners, 0);
} finally {
  for (const record of fixtures) {
    const stat = fs.lstatSync(record.path);
    assert(record.identity && stat.isDirectory() && !stat.isSymbolicLink()
      && stat.dev === record.identity.dev && stat.ino === record.identity.ino);
    fs.rmSync(record.path, { recursive: true, force: false });
    try { fs.lstatSync(record.path); } catch (error) { if (error.code === 'ENOENT') record.removed = true; else throw error; }
    assert(record.removed);
  }
  const receipt = `${JSON.stringify({ selected: 7, passed: groups.length, groups, spawns, listeners, fixtures,
    allFixturesRemoved: fixtures.every(item => item.removed), actualTargets: 0 })}\n`;
  assert(Buffer.byteLength(receipt) <= 4096); process.stdout.write(receipt);
}
