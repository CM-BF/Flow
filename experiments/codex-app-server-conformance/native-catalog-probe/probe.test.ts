import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { runNativeCatalogProbe, inspectOwnedRoots, bounds } from './probe.mjs';
import { prepareDelivery } from './execute-reviewed.mjs';

const owned: string[] = [];
afterEach(() => { for (const directory of owned.splice(0)) fs.rmSync(directory, { recursive: true, force: true }); });
const page = { data: [{ id: 'fixture', model: 'fixture', displayName: 'Fixture', hidden: false, isDefault: true,
  supportedReasoningEfforts: [{ reasoningEffort: 'low', description: '' }], defaultReasoningEffort: 'low',
  serviceTiers: [], defaultServiceTier: null }], nextCursor: null };
function setup(options: Record<string, any> = {}) {
  const base = fs.mkdtempSync('/private/tmp/flow-native-probe-fake-'); owned.push(base);
  const evidenceDirectory = path.join(base, 'evidence'); fs.mkdirSync(evidenceDirectory);
  const messages = [...(options.messages ?? [])]; let waiter: ((value: any) => void) | undefined, closed = false;
  const stderr = Buffer.from(options.stderr ?? 'fixture stderr');
  const request = vi.fn(async () => { if (options.requestError) throw options.requestError; return options.page ?? page; });
  const close = vi.fn(async () => { closed = true; waiter?.(null); return { reason: 'CLOSED', child: 'confirmed-exited',
    exitCode: 0, signal: null, remoteEffects: 'unknown', stderrCapture: { observedBytes: stderr.length,
      writtenBytes: stderr.length, truncated: false, observerFailed: false, streamEnded: true, childCloseObserved: true,
      incomplete: false, ...options.stderrReport }, ...options.closeReport }; });
  const factory = vi.fn((config: any) => {
    config.privateStderr.write(stderr);
    return { ready: options.readyError ? Promise.reject(options.readyError) : Promise.resolve({}), request, close,
      receive: () => messages.length ? Promise.resolve(messages.shift()) : closed ? Promise.resolve(null)
        : new Promise(resolve => { waiter = resolve; }),
      snapshot: () => ({ pid: 4242, stderrBytes: stderr.length, ignoredResponses: options.ignoredResponses ?? 0 }) };
  });
  const input = { factory, native: '/fixed/native', policyBytes: Buffer.from('(version 1)'), evidenceDirectory,
    preparedBytes: 1000, initialReceiptBytes: 0 };
  return { input, base, evidenceDirectory, factory, request, close,
    run: (io = fs) => runNativeCatalogProbe(input, { io, rootBase: base, now: () => 100 }) };
}

describe('native catalog caller without any real child or listener', () => {
  it('uses exact native argv/env, one initialized R06 request, and controlled close', async () => {
    const fixture = setup(); const result = await fixture.run();
    expect(fixture.factory).toHaveBeenCalledTimes(1); expect(fixture.request).toHaveBeenCalledTimes(1);
    const config = fixture.factory.mock.calls[0][0];
    expect(config.spawn.args.slice(-4)).toEqual(['/fixed/native', 'app-server', '--listen', 'stdio://']);
    expect(Object.keys(config.spawn.environment).sort()).toEqual(['CODEX_HOME','HOME','LANG','LC_ALL','PATH','TMPDIR','TZ']);
    expect(config.limits.pendingRequests).toBe(1);
    expect(fixture.request).toHaveBeenCalledWith('model/list', { cursor: null, limit: 20, includeHidden: false }, { timeoutMs: 10000 });
    expect(fixture.close).toHaveBeenCalledTimes(1); expect(result.status).toBe('CATALOG_OBSERVED');
    expect(result.rootCleanupComplete).toBe(true); expect(result.output.stdoutWireBytes).toBeNull();
    expect(result.retainedDiagnosticArtifact.complete).toBe(true);
    expect(result.roots.every((root: any) => !fs.existsSync(root.path))).toBe(true);
    expect(prepareDelivery(result, 110).passes).toBe(true);
  });
  it('records a cursor as partial and never paginates', async () => {
    const fixture = setup({ page: { ...page, nextCursor: 'next' } }); const result = await fixture.run();
    expect(result.partial).toBe(true); expect(fixture.request).toHaveBeenCalledTimes(1);
    expect(result.catalog.accountAvailability).toBe('unknown');
  });
  it.each([
    { kind: 'server-request', method: 'account/chatgptAuthTokens/refresh', id: 1, params: null },
    { kind: 'notification', method: 'unrecognized', params: null },
  ])('closes on inbound $kind instead of sending catalog or responding', async message => {
    const fixture = setup({ messages: [message] }); const result = await fixture.run();
    expect(fixture.request).not.toHaveBeenCalled(); expect(fixture.close).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('FAILED_OR_UNKNOWN'); expect(result.modelListCalls).toBe(0);
  });
  it.each([{ page: { data: [], nextCursor: 123 } }, { requestError: { code: 'TIMEOUT', message: 'do not print me' } },
    { readyError: { code: 'PROTOCOL' } }])('closes for invalid catalog or readiness/request failure', async scenario => {
    const fixture = setup(scenario); const result = await fixture.run();
    expect(result.status).toBe('FAILED_OR_UNKNOWN'); expect(fixture.close).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain('do not print me');
  });
  it('keeps prefix artifact and roots when child/stdio completion is unknown', async () => {
    const fixture = setup({ closeReport: { child: 'unconfirmed' }, stderrReport: { streamEnded: false, incomplete: true } });
    const result = await fixture.run();
    expect(result.processCleanupComplete).toBe(false); expect(result.retainedRoots).toHaveLength(2);
    expect(result.retainedDiagnosticArtifact.bytes).toBe(Buffer.byteLength('fixture stderr'));
    expect(result.retainedDiagnosticArtifact.complete).toBe(false); expect(prepareDelivery(result, 110).passes).toBe(false);
  });
  it('registers the created root before identity acquisition fails, without calling factory', async () => {
    const fixture = setup();
    const io = { ...fs, lstatSync(file: any) {
      if (String(file).includes('flow-native-catalog-allow-')) throw Error('injected identity failure');
      return fs.lstatSync(file);
    } };
    const result = await fixture.run(io as any);
    expect(fixture.factory).not.toHaveBeenCalled(); expect(result.retainedRoots).toHaveLength(1);
    expect(result.retainedRoots[0].identity).toBeNull(); expect(fs.existsSync(result.retainedRoots[0].path)).toBe(true);
  });
  it('preserves original stderr, partial artifact, and descriptors through final result failure', async () => {
    const fixture = setup({ stderr: '0123456789' }); const fdPaths = new Map<number, string>(); let partial = false;
    const io = { ...fs,
      openSync(file: any, flags: any, mode: any) {
        if (String(file).endsWith('/result.json')) throw Error('injected final receipt failure');
        const fd = fs.openSync(file, flags, mode); fdPaths.set(fd, String(file)); return fd;
      },
      writeSync(fd: number, bytes: any, offset: number, length: number) {
        if (fdPaths.get(fd)?.endsWith('/private-stderr.raw')) {
          if (partial) throw Error('injected partial-copy failure'); partial = true;
          return fs.writeSync(fd, bytes, offset, Math.min(2, length));
        }
        return fs.writeSync(fd, bytes, offset, length);
      },
    };
    const result = await fixture.run(io as any); const delivery = prepareDelivery(result, 110);
    expect(result.resultPersisted).toBe(false); expect(result.withinBudget).toBe(false);
    expect(result.retainedDiagnosticArtifact.bytes).toBe(2); expect(result.retainedDiagnosticArtifact.identity).not.toBeNull();
    expect(result.retainedRoots).toHaveLength(2); expect(result.retainedRoots[0].originalStderrSaved).toBe(true);
    expect(fs.readFileSync(path.join(result.retainedRoots[0].path, 'control/stderr.raw'), 'utf8')).toBe('0123456789');
    expect(JSON.parse(delivery.line).retainedDiagnosticArtifact.identity).toEqual(result.retainedDiagnosticArtifact.identity);
    expect(JSON.parse(delivery.line).retainedRoots).toEqual(result.retainedRoots); expect(delivery.passes).toBe(false);
    expect(fixture.factory).toHaveBeenCalledTimes(1);
  });
  it('keeps result-file partial identity in the final delivery after a write failure', async () => {
    const fixture = setup(); const fdPaths = new Map<number, string>(); let partial = false;
    const io = { ...fs,
      openSync(file: any, flags: any, mode: any) { const fd = fs.openSync(file, flags, mode); fdPaths.set(fd, String(file)); return fd; },
      writeSync(fd: number, bytes: any, offset: number, length: number) {
        if (fdPaths.get(fd)?.endsWith('/result.json')) {
          if (partial) throw Error('injected result partial write'); partial = true;
          return fs.writeSync(fd, bytes, offset, Math.min(5, length));
        }
        return fs.writeSync(fd, bytes, offset, length);
      },
    };
    const result = await fixture.run(io as any); const record = result.descriptors.find((x: any) => x.file.endsWith('/result.json'));
    expect(record).toMatchObject({ owned: true, bytes: 5, closed: true }); expect(record.identity).not.toBeNull();
    expect(result.resultPersisted).toBe(false); expect(prepareDelivery(result, 110).passes).toBe(false);
    expect(JSON.parse(prepareDelivery(result, 110).line).descriptors).toContainEqual(record);
  });
  it('rejects byte excess and nested directory replacement in bounded inventory', () => {
    const base = fs.mkdtempSync('/private/tmp/flow-native-probe-inventory-'); owned.push(base);
    const nested = path.join(base, 'nested'); fs.mkdirSync(nested); const stat = fs.lstatSync(base);
    const roots = [{ path: base, identity: { dev: stat.dev, ino: stat.ino } }];
    const large = inspectOwnedRoots(roots, { ...fs, lstatSync(file: any) {
      const value = fs.lstatSync(file); if (String(file) === nested) value.size = bounds.ownBytes + 1; return value;
    } } as any);
    expect(large.complete).toBe(false); expect(large.withinLimit).toBe(false);
    let enumerated = false;
    const changed = inspectOwnedRoots(roots, { ...fs,
      readdirSync(file: any) { if (String(file) === nested) enumerated = true; return fs.readdirSync(file); },
      lstatSync(file: any) { const value = fs.lstatSync(file); if (String(file) === nested && enumerated) value.ino += 1; return value; },
    } as any);
    expect(changed.complete).toBe(false); expect(changed.withinLimit).toBe(false);
  });
});
