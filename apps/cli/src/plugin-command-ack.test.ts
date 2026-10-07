import { mkdtemp, writeFile, unlink, rmdir, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { runCli } from './index.js';
import { configure, grant, configured, granted, id, response } from '../../../docs/evidence/x01-plugin-command-acks/fixtures.js';
let dir: string, file: string, identity: Awaited<ReturnType<typeof lstat>>;
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'ack-')); file = join(dir, 'input.json'); identity = await lstat(dir); });
afterEach(async () => { vi.restoreAllMocks(); await unlink(file).catch(error => { if (error.code !== 'ENOENT') throw error; }); const current = await lstat(dir); expect([current.dev, current.ino]).toEqual([identity.dev, identity.ino]); await rmdir(dir); });
async function cli() { const out: string[] = [], err: string[] = []; const code = await runCli(['plugin', 'change', id, '--input', file, '--key', 'original'], { out: t => out.push(t), err: t => err.push(t) }, { FLOW_URL: 'http://127.0.0.1:1', FLOW_TOKEN: 'fixture-owner' }); return { code, out, err }; }
it('uses unchanged real CLI for configuration and grants with checked FlowClient receipts', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response(configured())).mockResolvedValueOnce(response(granted()));
  await writeFile(file, JSON.stringify(configure)); expect((await cli()).code).toBe(0);
  await writeFile(file, JSON.stringify(grant)); const result = await cli(); expect(result.code).toBe(0); expect(JSON.parse(result.out[0]!)).toEqual(granted()); expect(fetch).toHaveBeenCalledTimes(2);
});
it('keeps malformed ACK unknown4 distinct from request usage2 and trusted conflict3', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response({})).mockResolvedValueOnce(response({ error: { code: 'plugin_revision_conflict', message: 'changed' } }, 409));
  await writeFile(file, JSON.stringify(configure)); const result = await cli(); expect(result.code).toBe(4); expect(result.err.join('')).toContain('original --key'); expect(result.out).toEqual([]);
  expect((await cli()).code).toBe(3); await writeFile(file, '{}'); expect((await cli()).code).toBe(2); expect(fetch).toHaveBeenCalledTimes(2);
});
it.each([
  { expectedRevision: 2_147_483_647, exit: 4 },
  { expectedRevision: 2_147_483_646, exit: 0 },
])('checks maximum revision acknowledgement $expectedRevision', async ({ expectedRevision, exit }) => {
  const input = { ...configure, expectedRevision }, receipt = configured();
  receipt.operation.beforeRevision = expectedRevision;
  receipt.operation.afterRevision = expectedRevision + 1;
  receipt.snapshot.revision = expectedRevision + 1;
  receipt.snapshot.installation.revision = expectedRevision + 1;
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response(receipt));
  await writeFile(file, JSON.stringify(input));
  const result = await cli();
  expect(result.code).toBe(exit);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string).expectedRevision).toBe(expectedRevision);
  if (exit === 4) {
    expect(result.out).toEqual([]);
    expect(result.err.join('')).toContain('original --key');
  } else expect(JSON.parse(result.out[0]!).snapshot.revision).toBe(2_147_483_647);
});
