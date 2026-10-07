import { afterEach, expect, it, vi } from 'vitest';
import { FlowClient, UnknownPluginAcknowledgementError } from './index.js';
import { id, material, query, page, reference, uuid, response } from '../../../docs/evidence/x01-removal-references-client/fixtures.js';
afterEach(() => vi.restoreAllMocks());
const client = () => new FlowClient({ baseUrl: 'https://flow.example', token: 'owner-fixture' });
it('reads one reference page, retaining same-material different operations and server microsecond order', async () => {
  const body = page(); body.references = [reference(12), reference(10)];
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response(body));
  expect(await client().pluginRemovalReferences(id, query)).toEqual(body);
  expect(fetch).toHaveBeenCalledTimes(1);
  const [url, init] = fetch.mock.calls[0]!;
  expect(String(url)).toBe(`https://flow.example/api/plugins/${id}/removal-references?materialInstallOperationId=${material}`);
  expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer owner-fixture');
  expect(init?.method).toBeUndefined(); expect(init?.body).toBeUndefined();
});
it('preserves empty pages with next and only fetches again when explicitly called', async () => {
  const empty = { ...page(), references: [], nextCursor: 'Opaque_microseconds_page2' };
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response(empty)).mockResolvedValueOnce(response(page()));
  expect(await client().pluginRemovalReferences(id, query)).toEqual(empty); expect(fetch).toHaveBeenCalledTimes(1);
  await client().pluginRemovalReferences(id, { ...query, cursor: empty.nextCursor });
  expect(String(fetch.mock.calls[1]![0])).toContain('&cursor=Opaque_microseconds_page2'); expect(fetch).toHaveBeenCalledTimes(2);
});
it('detaches the query and uses existing cookie authentication without a write or CSRF request', async () => {
  const input = { ...query }; const fetch = vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async () => { input.materialInstallOperationId = uuid(9); return response(page()); });
  const body = await new FlowClient({ baseUrl: 'https://flow.example', browserSession: { csrfToken: () => undefined } }).pluginRemovalReferences(id, input);
  expect(body.materialInstallOperationId).toBe(material); expect(fetch.mock.calls[0]![1]?.credentials).toBe('include');
  const headers = new Headers(fetch.mock.calls[0]![1]?.headers); expect(headers.has('Authorization')).toBe(false); expect(headers.has('X-Flow-CSRF')).toBe(false);
});
it.each([
  ['registration', (p: ReturnType<typeof page>) => { p.registrationId = uuid(9); }],
  ['query operation', (p: ReturnType<typeof page>) => { p.materialInstallOperationId = uuid(9); }],
  ['duplicate binding', (p: ReturnType<typeof page>) => { p.references.push(reference()); }],
  ['repeated cursor', (p: ReturnType<typeof page>) => { p.nextCursor = 'Same_cursor'; }],
  ['deletion authority', (p: ReturnType<typeof page>) => { p.physicalRemoval = 'authorized'; }],
  ['cross-registration coverage', (p: ReturnType<typeof page>) => { p.coverage = 'all-registrations'; }],
  ['oversized page', (p: ReturnType<typeof page>) => { p.references = Array.from({ length: 41 }, (_, i) => reference(i + 10)); }],
] as const)('rejects unverified removal %s as UNKNOWN without retry', async (_, mutate) => {
  const body = page(); mutate(body); const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response(body));
  await expect(client().pluginRemovalReferences(id, { ...query, cursor: 'Same_cursor' })).rejects.toBeInstanceOf(UnknownPluginAcknowledgementError);
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('preserves typed revision conflicts and maps malformed, oversized and cancelled reads to UNKNOWN', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response({ error: { code: 'plugin_removal_cursor_changed', message: 'changed' } }, 409))
    .mockResolvedValueOnce(new Response('{')).mockResolvedValueOnce(new Response(' '.repeat(65537)))
    .mockResolvedValueOnce(new Response('x'.repeat(4097), { status: 502 }));
  await expect(client().pluginRemovalReferences(id, { ...query, cursor: 'Old_cursor' })).rejects.toMatchObject({ status: 409, code: 'plugin_removal_cursor_changed' });
  for (let i = 0; i < 3; i++) await expect(client().pluginRemovalReferences(id, query)).rejects.toBeInstanceOf(UnknownPluginAcknowledgementError);
  const abort = new AbortController(); abort.abort(new Error('panel closed'));
  fetch.mockImplementationOnce(async (_, init) => { init!.signal!.throwIfAborted(); return response(page()); });
  await expect(client().pluginRemovalReferences(id, query, abort.signal)).rejects.toBeInstanceOf(UnknownPluginAcknowledgementError);
  expect(fetch).toHaveBeenCalledTimes(5);
});
it('rejects bad inputs before transport and accepts the full 40 item page and 768 character opaque cursor', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch');
  for (const bad of [{ ...query, cursor: '' }, { ...query, cursor: 'x'.repeat(769) }, { ...query, limit: 40 }]) expect(() => client().pluginRemovalReferences(id, bad)).toThrow();
  expect(() => client().pluginRemovalReferences('not-a-uuid', query)).toThrow(); expect(fetch).not.toHaveBeenCalled();
  const body = page(); body.references = Array.from({ length: 40 }, (_, i) => reference(i + 10)); body.storeId = '\u0001'.repeat(128);
  fetch.mockResolvedValueOnce(response(body)); expect(await client().pluginRemovalReferences(id, { ...query, cursor: 'x'.repeat(768) })).toEqual(body);
});
