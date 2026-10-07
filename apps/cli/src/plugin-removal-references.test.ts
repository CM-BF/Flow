import { afterEach, expect, it, vi } from 'vitest';
import { runCli } from './index.js';
import { id, material, page, response } from '../../../docs/evidence/x01-removal-references-client/fixtures.js';
afterEach(() => vi.restoreAllMocks());
async function cli(args: string[] = []) { const out: string[] = [], err: string[] = []; const code = await runCli(['plugin', 'removal-references', id, material, ...args], { out: v => out.push(v), err: v => err.push(v) }, { FLOW_URL: 'https://flow.example', FLOW_TOKEN: 'fixture-owner' }); return { code, out, err }; }
it('prints the checked observation and manual continuation without claiming deletion permission', async () => {
  const body = { ...page(), references: [], nextCursor: 'Next_page' }; const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response(body));
  const result = await cli(['--after', 'Prior_page']); expect(result.code).toBe(0); expect(JSON.parse(result.out[0]!)).toEqual(body); expect(fetch).toHaveBeenCalledTimes(1);
  expect(String(fetch.mock.calls[0]![0])).toContain('&cursor=Prior_page');
  expect(result.out[0]).toContain('not-authorized'); expect(result.out[0]).toContain('registration-tool-task-bindings');
});
it('keeps usage, unknown response and typed stale-cursor rejection distinct without resetting the cursor', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response({})).mockResolvedValueOnce(response({ error: { code: 'plugin_removal_cursor_changed', message: 'changed' } }, 409));
  for (const args of [['--limit', '40'], ['--before', 'cursor'], ['unexpected'], ['--after', '']]) expect((await cli(args)).code).toBe(2);
  expect(fetch).not.toHaveBeenCalled(); const bad = await cli(); expect(bad.code).toBe(4); expect(bad.out).toEqual([]); expect(bad.err.join('')).toContain('No state was inferred');
  const conflict = await cli(['--after', 'Old_page']); expect(conflict.code).toBe(3); expect(conflict.out).toEqual([]); expect(String(fetch.mock.calls[1]![0])).toContain('&cursor=Old_page'); expect(fetch).toHaveBeenCalledTimes(2);
});
