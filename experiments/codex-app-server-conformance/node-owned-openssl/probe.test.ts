import { it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { runCause } from '../node-loader-cause/host.mjs';
import { prepareDelivery } from './execute-reviewed.mjs';
const roots: string[] = [];
const output = Buffer.from('flow-diag-prefix\n中🙂\nflow-diag-tail\n');
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
function setup() {
  const root = fs.mkdtempSync('/private/tmp/flow-owned-openssl-test-'); roots.push(root);
  const evidenceDirectory = path.join(root, 'evidence'); fs.mkdirSync(evidenceDirectory);
  return { evidenceDirectory, repository: process.cwd(), preparedBytes: 0, roles: [], recipe: 'owned-openssl',
    io: { ...fs, mkdtempSync: () => fs.mkdtempSync(path.join(root, 'target-')) } };
}
function response(budget: any, code = 7) {
  budget.observe(output.length); budget.consume(output.length);
  const stream = (bytes: number) => ({ observedBytes: bytes, writtenBytes: bytes, streamEnded: true, childCloseObserved: true, incomplete: false, observerFailed: false, truncated: false });
  return { safe: { reason: 'completed', code, signal: null, closeObserved: true, groupGone: true, streams: { stderr: stream(output.length), stdout: stream(0) } }, stderr: output, stdout: Buffer.alloc(0) };
}
it('one fixed owned config argument uses exact comment-only content without environment or profile changes', async () => {
  const t = setup(); const command = vi.fn(async (options, budget) => {
    const config = options.args.find((x: string) => x.startsWith('--openssl-config='))?.slice('--openssl-config='.length);
    expect(config).toBe(path.join(path.dirname(options.args.at(-1)), 'openssl.cnf'));
    expect(fs.readFileSync(config, 'utf8')).toBe('# Owned diagnostic configuration.\n');
    expect(fs.statSync(config).mode & 0o777).toBe(0o400);
    const executableIndex = options.args.indexOf('/opt/homebrew/Cellar/node@24/24.20.0/bin/node');
    expect(options.args.slice(executableIndex + 1, -1)).toEqual([`--openssl-config=${config}`, '--jitless', '--no-addons']);
    expect(createHash('sha256').update(fs.readFileSync(options.args[options.args.indexOf('-f') + 1])).digest('hex')).toBe('37023e6516aa4ef6552a720b7d08d27aadb48fc7947d36b414ebd5c329391213');
    expect(Object.keys(options.environment).sort()).toEqual(['CODEX_HOME', 'HOME', 'LANG', 'LC_ALL', 'PATH', 'TMPDIR', 'TZ']);
    return response(budget);
  });
  const r = await runCause(t, { io: t.io, command, now: () => 1 });
  expect(command).toHaveBeenCalledOnce(); expect(r.retainedDiagnosticArtifact.complete).toBe(true);
  expect(r.output.disk).toBe(16762 + 379 + Buffer.byteLength('# Owned diagnostic configuration.\n') + 80);
  expect(r.cleanupComplete).toBe(true); expect(prepareDelivery(r, 2).passes).toBe(true);
});
it('old failure-text recipe remains without the config argument or control file', async () => {
  const t = setup(); const command = vi.fn(async (options, budget) => {
    expect(options.args.some((x: string) => x.startsWith('--openssl-config='))).toBe(false);
    expect(fs.existsSync(path.join(path.dirname(options.args.at(-1)), 'openssl.cnf'))).toBe(false);
    return response(budget);
  });
  const r = await runCause({ ...t, recipe: 'failure-text' }, { io: t.io, command, now: () => 1 });
  expect(command).toHaveBeenCalledOnce(); expect(r.output.disk).toBe(16762 + 379 + 80);
});
it('owned config preparation failure consumes no target and cannot pass or fall back', async () => {
  const t = setup(); const open = t.io.openSync;
  t.io.openSync = ((file: any, ...rest: any[]) => { if (String(file).endsWith('/openssl.cnf')) throw Error('SYNTHETIC_CONFIG'); return (open as any)(file, ...rest); }) as any;
  const command = vi.fn(); const r = await runCause(t, { io: t.io, command, now: () => 1 });
  expect(command).not.toHaveBeenCalled(); expect(r.targetCalls).toBe(0); expect(r.cleanupComplete).toBe(true);
  expect(prepareDelivery(r, 2).passes).toBe(false);
});
it('a completed failing target preserves text and cleanup but is not the expected exit7 control', async () => {
  const t = setup(); const command = vi.fn(async (_: any, budget: any) => response(budget, 1));
  const r = await runCause(t, { io: t.io, command, now: () => 1 });
  expect(command).toHaveBeenCalledOnce(); expect(r.retainedDiagnosticArtifact.complete).toBe(true);
  expect(r.cleanupComplete).toBe(true); expect(r.close.code).toBe(1); expect(prepareDelivery(r, 2).passes).toBe(false);
});
