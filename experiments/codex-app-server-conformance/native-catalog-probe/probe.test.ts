import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { runNativeCatalogProbe, inspectOwnedRoots, bounds } from './probe.mjs';
import { prepareDelivery, reserveEntry, entryFailure } from './execute-reviewed.mjs';

const owned: { path: string; identity: { dev: number; ino: number } | null; removed: boolean }[] = [];
function fixtureRoot(prefix: string) {
  const directory = fs.mkdtempSync(prefix);
  const record = { path: directory, identity: null as { dev: number; ino: number } | null, removed: false }; owned.push(record);
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw Error('Unknown fixture root');
  record.identity = { dev: stat.dev, ino: stat.ino }; return directory;
}
afterEach(() => {
  for (const record of owned.filter(item => !item.removed)) {
    const stat = fs.lstatSync(record.path);
    if (!record.identity || !stat.isDirectory() || stat.isSymbolicLink()
      || stat.dev !== record.identity.dev || stat.ino !== record.identity.ino) throw Error('Fixture identity changed');
    fs.rmSync(record.path, { recursive: true, force: false });
    try { fs.lstatSync(record.path); } catch (error: any) { if (error?.code === 'ENOENT') record.removed = true; else throw error; }
    expect(record.removed).toBe(true);
  }
});
afterAll(() => {
  const bytes = Buffer.from(`${JSON.stringify({ fixtures: owned, allRemoved: owned.every(item => item.removed) })}\n`);
  if (bytes.length > 4096) throw Error('Fixture receipt bound');
  const receipt = process.env.FLOW_NATIVE_FAKE_PHASE === 'review-delta' ? 'delta-roots.json' : 'fake-roots.json';
  const fd = fs.openSync(`docs/evidence/wpf-mature-02/native-catalog-probe/checks/${receipt}`,
    fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
});
const page = { data: [{ id: 'fixture', model: 'fixture', displayName: 'Fixture', hidden: false, isDefault: true,
  supportedReasoningEfforts: [{ reasoningEffort: 'low', description: '' }], defaultReasoningEffort: 'low',
  serviceTiers: [], defaultServiceTier: null }], nextCursor: null };
function setup(options: Record<string, any> = {}) {
  const base = fixtureRoot('/private/tmp/flow-native-probe-fake-');
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
    const base = fixtureRoot('/private/tmp/flow-native-probe-inventory-');
    const nested = path.join(base, 'nested'); fs.mkdirSync(nested); const stat = fs.lstatSync(base);
    const roots = [{ path: base, identity: { dev: stat.dev, ino: stat.ino } }];
    const large = inspectOwnedRoots(roots, { ...fs, lstatSync(file: any) {
      const value = fs.lstatSync(file); if (String(file) === nested) value.size = bounds.ownBytes + 1; return value;
    } } as any);
    expect(large.complete).toBe(false); expect(large.withinLimit).toBe(false);
    let enumerated = false;
    const changed = inspectOwnedRoots(roots, { ...fs,
      opendirSync(file: any, options: any) {
        const directory = fs.opendirSync(file, options); if (String(file) === nested) enumerated = true; return directory;
      },
      lstatSync(file: any) { const value = fs.lstatSync(file); if (String(file) === nested && enumerated) value.ino += 1; return value; },
    } as any);
    expect(changed.complete).toBe(false); expect(changed.withinLimit).toBe(false);
  });
  it('review delta preserves entry reservation identity and exact zero targets on partial/flush/close failure', () => {
    const base = fixtureRoot('/private/tmp/flow-native-probe-entry-');
    for (const mode of ['partial', 'flush', 'close']) {
      const file = path.join(base, `${mode}.json`); let written = false;
      const io = { ...fs,
        writeSync(fd: number, bytes: any, offset: number, length: number) {
          if (mode === 'partial') { if (written) throw Error('partial failure'); written = true; return fs.writeSync(fd, bytes, offset, 2); }
          return fs.writeSync(fd, bytes, offset, length);
        },
        fsyncSync(fd: number) { if (mode === 'flush') throw Error('flush failure'); return fs.fsyncSync(fd); },
        closeSync(fd: number) { fs.closeSync(fd); if (mode === 'close') throw Error('close ACK unknown'); },
      };
      const artifact = reserveEntry(file, '{"consumed":true}\n', io as any);
      const result = entryFailure(artifact, 1000); const delivery = prepareDelivery(result, 100);
      expect(artifact.owned).toBe(true); expect(artifact.identity).not.toBeNull(); expect(artifact.complete).toBe(false);
      expect(artifact.bytes).toBe(mode === 'partial' ? 2 : 18);
      expect(result.targetCalls).toBe(0); expect(result.targetStarted).toBe('not-started'); expect(delivery.passes).toBe(false);
      expect(JSON.parse(delivery.line).entryReservation).toEqual(artifact);
    }
  });
  it('review delta does not recurse or write original stderr with an active/unknown target', async () => {
    const fixture = setup({ closeReport: { child: 'unconfirmed' }, stderrReport: { streamEnded: false, incomplete: true } });
    let active = false, activeOpens = 0; const originalFactory = fixture.input.factory;
    fixture.input.factory = vi.fn((config: any) => { active = true; return originalFactory(config); });
    const result = await fixture.run({ ...fs, opendirSync(file: any, options: any) {
      if (active) { activeOpens++; throw Error('Must not inspect active children'); } return fs.opendirSync(file, options);
    } } as any);
    expect(activeOpens).toBe(0); expect(result.finalInventory).toBe('not-observed-active-or-unknown');
    expect(result.retainedRoots).toHaveLength(2); expect(result.rootCleanupComplete).toBe(false);
    expect(fs.existsSync(path.join(result.roots[0].path, 'control/stderr.raw'))).toBe(false);
    expect(result.retainedDiagnosticArtifact.bytes).toBe(Buffer.byteLength('fixture stderr'));
  });
  it('review delta traverses only before factory and after confirmed close', async () => {
    const fixture = setup(); let active = false, started = false, activeOpens = 0, closedOpens = 0; const originalFactory = fixture.input.factory;
    fixture.input.factory = vi.fn((config: any) => {
      active = true; started = true; const transport = originalFactory(config);
      return { ...transport, close: async () => { const report = await transport.close(); active = false; return report; } };
    });
    const result = await fixture.run({ ...fs, opendirSync(file: any, options: any) {
      if (active) activeOpens++; else if (started) closedOpens++; return fs.opendirSync(file, options);
    } } as any);
    expect(activeOpens).toBe(0); expect(closedOpens).toBeGreaterThan(0);
    expect(result.status).toBe('CATALOG_OBSERVED'); expect(result.finalInventory).toBe('observed-after-close');
  });
  it('review delta does not write an original through a control symlink left after close', async () => {
    const fixture = setup(); const outside = path.join(fixture.base, 'outside-control'); fs.mkdirSync(outside);
    const originalFactory = fixture.input.factory;
    fixture.input.factory = vi.fn((config: any) => {
      const transport = originalFactory(config);
      const control = path.dirname(config.spawn.args[config.spawn.args.indexOf('-f') + 1]);
      return { ...transport, close: async () => {
        const report = await transport.close();
        fs.renameSync(control, `${control}-original`); fs.symlinkSync(outside, control);
        return report;
      } };
    });
    const result = await fixture.run();
    expect(result.processCleanupComplete).toBe(true); expect(result.outputAccountingComplete).toBe(false);
    expect(result.retainedRoots).toHaveLength(2); expect(result.rootCleanupComplete).toBe(false);
    expect(fs.existsSync(path.join(outside, 'stderr.raw'))).toBe(false);
    expect(result.retainedRoots.every((root: any) => !root.originalStderrSaved)).toBe(true);
    expect(result.retainedDiagnosticArtifact.complete).toBe(true); expect(prepareDelivery(result, 110).passes).toBe(false);
  });
  it('review delta reads entries incrementally and treats directory close failure as incomplete', () => {
    const base = fixtureRoot('/private/tmp/flow-native-probe-dir-'); const file = path.join(base, 'template'); fs.writeFileSync(file, '');
    const stat = fs.lstatSync(base), leaf = fs.lstatSync(file); const roots = [{ path: base, identity: { dev: stat.dev, ino: stat.ino } }];
    let reads = 0, closes = 0;
    const result = inspectOwnedRoots(roots, { ...fs,
      lstatSync(value: any) { return String(value) === base ? fs.lstatSync(value) : leaf; },
      opendirSync(value: any, options: any) {
        expect(options).toEqual({ bufferSize: 1, recursive: false });
        return { readSync() { reads++; return { name: `entry-${reads}` }; }, closeSync() { closes++; } };
      },
    } as any);
    expect(result.complete).toBe(false); expect(reads).toBeLessThanOrEqual(512); expect(closes).toBe(1);
    const unknownClose = inspectOwnedRoots(roots, { ...fs, opendirSync(value: any, options: any) {
      const dir = fs.opendirSync(value, options); return { readSync: () => dir.readSync(), closeSync() { dir.closeSync(); throw Error('close unknown'); } };
    } } as any);
    expect(unknownClose.complete).toBe(false);
  });
});
