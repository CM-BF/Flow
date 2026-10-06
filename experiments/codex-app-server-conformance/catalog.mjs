import assert from 'node:assert/strict';

function text(value, label, max = 256, allowEmpty = false) {
  assert.ok(typeof value === 'string' && (allowEmpty || value.length > 0)
    && Buffer.byteLength(value) <= max, `Invalid ${label}`);
  return value;
}

function unique(values, label) {
  assert.equal(new Set(values).size, values.length, `Duplicate ${label}`);
}

function normalizeModel(model) {
  const id = text(model.id, 'model id');
  const slug = text(model.model, 'model slug');
  assert.equal(typeof model.hidden, 'boolean');
  assert.equal(typeof model.isDefault, 'boolean');
  assert.ok(Array.isArray(model.supportedReasoningEfforts) && model.supportedReasoningEfforts.length <= 32);
  const efforts = model.supportedReasoningEfforts.map(option => ({
    id: text(option.reasoningEffort, 'effort'),
    description: text(option.description, 'effort description', 4000, true),
  }));
  unique(efforts.map(option => option.id), 'effort');
  const defaultEffort = text(model.defaultReasoningEffort, 'default effort');
  assert.ok(Array.isArray(model.serviceTiers) && model.serviceTiers.length <= 32);
  const serviceTiers = model.serviceTiers.map(tier => ({
    id: text(tier.id, 'service tier'),
    name: text(tier.name, 'tier name', 256, true),
    description: text(tier.description, 'tier description', 4000, true),
  }));
  unique(serviceTiers.map(tier => tier.id), 'service tier');
  if (model.defaultServiceTier !== null) text(model.defaultServiceTier, 'default service tier');
  return {
    id, model: slug, displayName: text(model.displayName, 'display name', 256, true),
    hidden: model.hidden, isDefault: model.isDefault,
    reasoning: { options: efforts, default: defaultEffort },
    speed: { options: serviceTiers, default: model.defaultServiceTier },
    provenance: {
      kind: 'codex-app-server-catalog', version: '0.154.0', accountAvailability: 'unknown',
      actualModel: 'unknown', actualReasoning: 'unknown', actualServiceTier: 'unknown',
    },
  };
}

/** Local bounds are Flow consumer policy, not extra claims about the native schema. */
export function normalizeModelPage(page) {
  assert.ok(page && Array.isArray(page.data) && page.data.length <= 100, 'Invalid model page');
  if (page.nextCursor !== null) text(page.nextCursor, 'cursor', 1024);
  const models = page.data.map(normalizeModel);
  unique(models.map(model => model.id), 'model id');
  return { models, nextCursor: page.nextCursor };
}

export function validateRequestedControls(model, selection) {
  assert.ok(selection && Object.getPrototypeOf(selection) === Object.prototype, 'Invalid requested controls');
  const allowed = new Set(['effort', 'serviceTier', 'serviceTierForTurn']);
  for (const key of Object.keys(selection)) {
    assert.ok(allowed.has(key), `Unsupported requested control: ${key}`);
    assert.ok(selection[key] === null || typeof selection[key] === 'string', 'Requested control must be a JSON string or null');
  }
  if (selection.effort !== undefined && selection.effort !== null) {
    assert.ok(model.reasoning.options.some(option => option.id === selection.effort), 'Effort not advertised');
  }
  for (const key of ['serviceTier', 'serviceTierForTurn']) {
    const value = selection[key];
    if (value === undefined || value === null || key === 'serviceTierForTurn' && value === 'default') continue;
    assert.ok(model.speed.options.some(option => option.id === value), 'Service tier not advertised');
  }
  return {
    requested: structuredClone(selection),
    semantics: {
      effort: 'thread-override; null/omitted semantics unknown',
      serviceTier: 'thread-override; null/omitted semantics unknown',
      serviceTierForTurn: 'new-turn-only; null or omitted inherits; default is standard speed',
    },
    actual: 'unknown',
  };
}
