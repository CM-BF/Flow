import assert from 'node:assert/strict';
import { normalizeModelPage } from './catalog.mjs';

/** Caller first awaits R06 ready; only decoded model/list results enter this module. */
export async function discoverModels(peer, { maxPages = 4, pageSize = 50, maxModels = 200 } = {}) {
  for (const [value, bound] of [[maxPages, 16], [pageSize, 100], [maxModels, 1000]]) {
    assert.ok(Number.isInteger(value) && value > 0 && value <= bound, 'Invalid catalog bound');
  }
  const cursors = new Set();
  const ids = new Set();
  const models = [];
  let cursor = null;
  for (let pageNumber = 0; pageNumber < maxPages; pageNumber++) {
    const raw = await peer.request('model/list', { cursor, limit: pageSize, includeHidden: false });
    assert.ok(Buffer.byteLength(JSON.stringify(raw)) <= 1048576, 'Decoded model page exceeds byte limit');
    const page = normalizeModelPage(raw);
    assert.ok(page.models.length <= pageSize && models.length + page.models.length <= maxModels, 'Model count exceeds bound');
    for (const model of page.models) {
      assert.ok(!ids.has(model.id), 'Duplicate model across pages');
      ids.add(model.id);
      models.push(model);
    }
    if (page.nextCursor === null) {
      return { protocolSource: 'codex-cli0.154.0', source: 'catalog', accountAvailability: 'unknown', models, pages: pageNumber + 1 };
    }
    assert.ok(!cursors.has(page.nextCursor), 'Model cursor did not advance');
    cursors.add(page.nextCursor);
    cursor = page.nextCursor;
  }
  throw Error('Model page limit reached; partial catalog not published');
}
