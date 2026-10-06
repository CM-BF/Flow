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
const { runNativeCatalogProbe } = await import('../native-catalog-observation/probe.mjs');
const { recordNotification, remoteControlStatusIsValid, notificationBounds } = await import('./notifications.mjs');
const { prepareDelivery } = await import('./execute-reviewed.mjs');
const { createReviewedEntry } = await import('../native-catalog-observation/execute-reviewed.mjs');
assert.throws(() => createReviewedEntry('unreviewed-window'));
const groups = [], fixtures = [];
const method = 'remoteControl/status/changed';
const params = status => ({ status, serverName: 'PRIVATE_SERVER', installationId: 'PRIVATE_INSTALLATION', environmentId: null });
const message = value => ({ kind: 'notification', method, params: value });
const state = () => ({ notificationCount: 0, notificationValueBytes: 0,
  notificationSummaries: [], notificationSummaryLimit: false, notificationOverflow: false });
function fixture() {
  const directory = fs.mkdtempSync('/private/tmp/flow-native-remote-status-fake-');
  const record = { path: directory, identity: null, removed: false }; fixtures.push(record);
  const stat = fs.lstatSync(directory); assert(stat.isDirectory() && !stat.isSymbolicLink());
  record.identity = { dev: stat.dev, ino: stat.ino }; return directory;
}
async function runFake(inbound, useValidator = true) {
  const base = fixture(), evidence = path.join(base, 'evidence'); fs.mkdirSync(evidence);
  const stderr = Buffer.from('synthetic stderr');
  let closed = false, waiter, resolvePage, rejectPage, delivered = false, pageReleased = false;
  let requests = 0, receives = 0, responses = 0;
  const factory = options => {
    options.privateStderr.write(stderr);
    return { ready: Promise.resolve({}), snapshot: () => ({ pid: 4242, stderrBytes: stderr.length, ignoredResponses: 0 }),
      request: () => {
        requests++;
        return new Promise((resolve, reject) => {
          resolvePage = resolve; rejectPage = reject;
          queueMicrotask(() => { assert(waiter); delivered = true; const accept = waiter; waiter = null; accept(inbound); });
        });
      },
      receive: () => {
        receives++; if (closed) return Promise.resolve(null);
        if (delivered && !pageReleased) { pageReleased = true; queueMicrotask(() => resolvePage({ data: [], nextCursor: null })); }
        return new Promise(resolve => { waiter = resolve; });
      },
      respond: () => { responses++; throw Error('No server response'); },
      close: async () => {
        closed = true; waiter?.(null); rejectPage?.(Error('controlled close'));
        return { reason: 'CLOSED', child: 'confirmed-exited', exitCode: 0, signal: null, remoteEffects: 'unknown',
          stderrCapture: { observedBytes: stderr.length, writtenBytes: stderr.length, truncated: false,
            observerFailed: false, streamEnded: true, childCloseObserved: true, incomplete: false } };
      } };
  };
  const dependencies = { rootBase: base, now: () => 100 };
  if (useValidator) dependencies.observeNotification = recordNotification;
  const result = await runNativeCatalogProbe({ factory, native: '/fixed/native', policyBytes: Buffer.from('(version 1)'),
    evidenceDirectory: evidence, preparedBytes: 1000 }, dependencies);
  return { result, requests, receives, responses, pageReleased };
}
try {
  {
    for (const status of ['disabled', 'connecting', 'connected', 'errored']) {
      for (const environmentId of [null, 'PRIVATE_ENVIRONMENT']) {
        const value = { ...params(status), environmentId }; assert(remoteControlStatusIsValid(value));
        const result = state(); assert.equal(recordNotification(result, message(value)), true);
        assert.equal(result.notificationSummaries[0].classification, 'REMOTE_STATUS_VALIDATED');
        assert.equal(result.notificationSummaries[0].payloadValidated, true);
        assert.equal(result.notificationSummaries[0].decision, 'continue');
        assert(!JSON.stringify(result).includes('PRIVATE'));
      }
    }
    for (const value of [null, [], true, { ...params('disabled'), extra: 1 }, { ...params('unknown') },
      { status: 'disabled', serverName: 'x', installationId: 'y' }, { ...params('disabled'), environmentId: 1 },
      { ...params('disabled'), serverName: null }, { ...params('disabled'), installationId: false }]) {
      assert.equal(remoteControlStatusIsValid(value), false);
      const result = state(); assert.equal(recordNotification(result, message(value)), false);
      assert.equal(result.notificationSummaries[0].classification, 'REMOTE_STATUS_INVALID');
      assert.equal(result.notificationSummaries[0].decision, 'stop'); assert.equal(result.notificationSummaries[0].payloadValidated, false);
    }
    groups.push('strict-four-field-shape-and-no-identity-output');
  }
  {
    for (const name of ['configWarning', 'deprecationNotice']) {
      const result = state(); assert.equal(recordNotification(result, { kind: 'notification', method: name, params: { secret: 'PRIVATE' } }), true);
      assert.equal(result.notificationSummaries[0].classification, 'PERMITTED_NAME'); assert.equal(result.notificationSummaries[0].payloadValidated, false);
    }
    for (const name of [method + '/extra', method + ' ', 'thread/started']) {
      const result = state(); assert.equal(recordNotification(result, { kind: 'notification', method: name, params: params('disabled') }), false);
      assert(!JSON.stringify(result).includes('PRIVATE')); assert.equal(result.notificationSummaries[0].decision, 'stop');
    }
    groups.push('exact-new-name-and-unchanged-default-notifications');
  }
  {
    const result = state(); for (let i = 0; i < 8; i++) assert.equal(recordNotification(result, message(params('disabled'))), true);
    assert.equal(recordNotification(result, message(params('disabled'))), false);
    assert.equal(result.notificationSummaries.length, 8); assert.equal(result.notificationOverflow, true);
    for (const extra of [0, 1]) {
      const next = state(); const inbound = message({ ...params('disabled'), serverName: '' });
      inbound.params.serverName = 'x'.repeat(notificationBounds.serializedValueBytes - Buffer.byteLength(JSON.stringify(inbound)) + extra);
      assert.equal(recordNotification(next, inbound), extra === 0);
      assert.equal(next.notificationSummaries[0].decision, extra ? 'stop' : 'continue');
      assert.equal(next.notificationSummaries[0].payloadValidated, true);
      assert(Buffer.byteLength(JSON.stringify(next.notificationSummaries)) <= notificationBounds.summaryBytes);
    }
    groups.push('eight-nine-and-decoded-value-byte-boundaries');
  }
  {
    const { result, requests, receives, pageReleased } = await runFake(message(params('disabled')));
    assert.equal(requests, 1); assert(receives >= 2); assert.equal(pageReleased, true);
    assert.equal(result.status, 'CATALOG_OBSERVED'); assert.equal(result.notificationSummaries[0].decision, 'continue');
    assert.equal(result.rootCleanupComplete, true); assert.equal(prepareDelivery(result, 110).passes, true);
    assert(!JSON.stringify(result).includes('PRIVATE')); groups.push('same-model-list-waits-through-validated-notification');
  }
  {
    const legacy = await runFake(message(params('disabled')), false);
    const invalid = await runFake(message({ ...params('disabled'), extra: 'PRIVATE' }));
    for (const { result, requests, pageReleased } of [legacy, invalid]) {
      assert.equal(requests, 1); assert.equal(pageReleased, false); assert.equal(result.catalog, null);
      assert.equal(result.failure, 'NOTIFICATION_UNKNOWN_OR_LIMIT'); assert.equal(result.rootCleanupComplete, true);
      assert.equal(result.notificationSummaries[0].decision, 'stop'); assert.equal(prepareDelivery(result, 110).passes, false);
    }
    assert.equal(legacy.result.notificationSummaries[0].classification, 'KNOWN_UNEXPECTED');
    assert.equal(invalid.result.notificationSummaries[0].classification, 'REMOTE_STATUS_INVALID');
    groups.push('legacy-default-and-invalid-payload-still-stop');
  }
  {
    const { result, requests, responses, pageReleased } = await runFake({ kind: 'server-request', id: 1, method, params: params('disabled') });
    assert.equal(requests, 1); assert.equal(responses, 0); assert.equal(pageReleased, false);
    assert.equal(result.failure, 'SERVER_REQUEST'); assert.equal(result.serverRequestObserved, true);
    assert.equal(result.notificationCount, 0); assert.equal(result.catalog, null); assert.equal(result.rootCleanupComplete, true);
    groups.push('server-request-stops-without-response');
  }
  assert.equal(spawns, 0); assert.equal(listeners, 0);
} finally {
  for (const record of fixtures) {
    const stat = fs.lstatSync(record.path);
    assert(record.identity && stat.isDirectory() && !stat.isSymbolicLink() && stat.dev === record.identity.dev && stat.ino === record.identity.ino);
    fs.rmSync(record.path, { recursive: true, force: false });
    try { fs.lstatSync(record.path); } catch (error) { if (error.code === 'ENOENT') record.removed = true; else throw error; }
    assert(record.removed);
  }
  const receipt = `${JSON.stringify({ selected: 6, passed: groups.length, groups, spawns, listeners, fixtures,
    allFixturesRemoved: fixtures.every(item => item.removed), actualTargets: 0 })}\n`;
  assert(Buffer.byteLength(receipt) <= 4096); process.stdout.write(receipt);
}
