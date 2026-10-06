import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeModelPage, validateRequestedControls } from './catalog.mjs';
import { discoverModels } from './discover.mjs';

function model(id = 'fixture-model') {
  return {
    id, model: id, displayName: 'Synthetic fixture', description: '', hidden: false, isDefault: true,
    upgrade: null, upgradeInfo: null, availabilityNux: null, modelSpecialty: null,
    supportedReasoningEfforts: [{ reasoningEffort: 'low', description: '' }, { reasoningEffort: 'future-effort', description: 'Catalog string' }],
    defaultReasoningEffort: 'low', inputModalities: ['text'], supportsPersonality: false, multiAgentVersion: null,
    additionalSpeedTiers: ['legacy-fast'], serviceTiers: [{ id: 'tier-fixture', name: 'Fixture tier', description: '' }],
    defaultServiceTier: null,
  };
}
const page = (models = [model()], nextCursor = null) => ({ data: models, nextCursor });
function peer(pages) {
  const calls = [];
  return { calls, async request(method, params) {
    calls.push({ method, params });
    assert.equal(method, 'model/list'); // No duplicate initialize/notify ownership.
    const value = pages[calls.length - 1];
    if (value instanceof Error) throw value;
    return structuredClone(value);
  } };
}

test('catalog choices preserve native strings, separate effort/speed and never assert entitlement', () => {
  const normalized = normalizeModelPage(page()).models[0];
  assert.deepEqual(normalized.reasoning.options.map(x => x.id), ['low', 'future-effort']);
  assert.deepEqual(normalized.speed.options.map(x => x.id), ['tier-fixture']);
  assert.equal(normalized.provenance.accountAvailability, 'unknown');
  assert.equal(normalized.provenance.actualServiceTier, 'unknown');
  assert.equal(validateRequestedControls(normalized, { effort: 'low' }).actual, 'unknown');
  assert.deepEqual(validateRequestedControls(normalized, { effort: 'future-effort' }).requested, { effort: 'future-effort' });
  for (const unsupported of [{ effort: 'high' }, { serviceTier: 'fast' }, { fast: true }, { serviceTier: 'legacy-fast' }]) {
    assert.throws(() => validateRequestedControls(normalized, unsupported));
  }
});

test('omission, explicit null and turn-only default survive without inferred persistent-null semantics', () => {
  const normalized = normalizeModelPage(page()).models[0];
  for (const input of [{}, { serviceTier: null }, { serviceTierForTurn: null }, { serviceTierForTurn: 'default' }, { serviceTier: 'tier-fixture' }]) {
    const result = validateRequestedControls(normalized, input);
    assert.deepEqual(result.requested, input);
    assert.equal(Object.hasOwn(result.requested, 'serviceTier'), Object.hasOwn(input, 'serviceTier'));
    assert.match(result.semantics.serviceTier, /null\/omitted semantics unknown/);
  }
  assert.throws(() => validateRequestedControls(normalized, { serviceTier: 'default' }), /not advertised/);
  assert.throws(() => validateRequestedControls(normalized, { serviceTier: undefined }), /JSON string or null/);
});

test('catalog rejects duplicate choices, oversized UTF8 and malformed cursor; absent default option grants nothing', () => {
  for (const change of [m => m.supportedReasoningEfforts.push(m.supportedReasoningEfforts[0]),
    m => m.serviceTiers.push(m.serviceTiers[0]), m => { m.id = '汉'.repeat(100); }, m => { delete m.hidden; }]) {
    const raw = model(); change(raw);
    assert.throws(() => normalizeModelPage(page([raw])));
  }
  assert.throws(() => normalizeModelPage(page([model(), model()])), /Duplicate model id/);
  assert.throws(() => normalizeModelPage(page([], '汉'.repeat(400))), /cursor/);
  const raw = model(); raw.defaultServiceTier = 'unadvertised-default';
  const normalized = normalizeModelPage(page([raw])).models[0];
  assert.equal(normalized.speed.default, 'unadvertised-default');
  assert.throws(() => validateRequestedControls(normalized, { serviceTier: 'unadvertised-default' }), /not advertised/);
});

test('ready caller seam walks exact cursors and only publishes a complete bounded catalog', async () => {
  const input = peer([page([model('one')], 'cursor-2'), page([model('two')])]);
  const result = await discoverModels(input, { pageSize: 1 });
  assert.deepEqual(input.calls, [
    { method: 'model/list', params: { cursor: null, limit: 1, includeHidden: false } },
    { method: 'model/list', params: { cursor: 'cursor-2', limit: 1, includeHidden: false } },
  ]);
  assert.deepEqual(result.models.map(x => x.id), ['one', 'two']);
  assert.equal(result.accountAvailability, 'unknown');
});

for (const [name, pages, bounds, error] of [
  ['cursor loop', [page([], 'same'), page([], 'same')], {}, /did not advance/],
  ['duplicate identity across pages', [page([model()], 'next'), page([model()])], {}, /Duplicate model across/],
  ['page overflow', [page([], 'next')], { maxPages: 1 }, /partial catalog not published/],
  ['total model overflow', [page([model('one')], 'next'), page([model('two')])], { maxModels: 1 }, /count exceeds/],
  ['response exceeds requested page size', [page([model('one'), model('two')])], { pageSize: 1 }, /count exceeds/],
  ['decoded byte overflow', [{ ...page(), unused: 'x'.repeat(1048576) }], {}, /byte limit/],
]) {
  test(`catalog rejects ${name}`, async () => {
    await assert.rejects(discoverModels(peer(pages), bounds), error);
  });
}

test('unknown RPC delivery propagates once without retry or partial-success catalog', async () => {
  const input = peer([page([model()], 'next'), new Error('unknown delivery')]);
  await assert.rejects(discoverModels(input), /unknown delivery/);
  assert.equal(input.calls.length, 2);
});

test('invalid bounds reject before using transport', async () => {
  const input = peer([]);
  for (const bounds of [{ maxPages: 0 }, { pageSize: 101 }, { maxModels: 1001 }]) {
    await assert.rejects(discoverModels(input, bounds), /Invalid catalog bound/);
  }
  assert.equal(input.calls.length, 0);
});
