import { afterAll, beforeAll, expect, it } from 'vitest';
import { startFixture } from '../../../../experiments/bounded-preview/fixture.js';
let fixture: Awaited<ReturnType<typeof startFixture>>;
beforeAll(async () => { fixture = await startFixture('preview'); });
afterAll(async () => { await fixture?.close(); });
it('returns a bounded preview from PostgreSQL without transferring the full typed body to the page reader', async () => {
  const [turn] = await fixture.seed(['x'.repeat(131072)]);
  const page = await fixture.http('/api/conversations/' + turn!.conversationId + '/turns?limit=1', undefined, true);
  expect(page.status).toBe(200);
  expect(page.body.turns[0].assistant).toMatchObject({ state: 'available', text: 'x'.repeat(4000), truncated: true });
  const decodedBytes = Object.values(page.work!.sql).reduce((sum,value) => sum + value.decodedRowsJsonUtf8Bytes, 0);
  expect(decodedBytes).toBeLessThan(20_000);
});
