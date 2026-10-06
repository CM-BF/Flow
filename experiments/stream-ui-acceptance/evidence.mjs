import assert from 'node:assert/strict';
import { open, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export function redactText(value, secrets = []) {
  let text = String(value);
  for (const secret of secrets.filter(value => typeof value === 'string' && value.length).sort((a, b) => b.length - a.length)) {
    for (const form of new Set([secret, JSON.stringify(secret).slice(1, -1)])) text = text.replaceAll(form, '[REDACTED]');
  }
  return text;
}
async function syncDirectory(path) {
  const directory = await open(dirname(path), 'r');
  try { await directory.sync(); } finally { await directory.close(); }
}
export async function reserveWindow(path, window) {
  assert.equal(window.mode, 'synthetic'); // A real permit is a separate, unimplemented entry point.
  const file = await open(path, 'wx', 0o600);
  try { await file.writeFile(JSON.stringify(window) + '\n'); await file.sync(); } finally { await file.close(); }
  await syncDirectory(path);
}
export function createCheckpoint(path, evidence, secrets = []) {
  let chain = Promise.resolve();
  return () => {
    const serialized = redactText(JSON.stringify(evidence, null, 2), secrets) + '\n';
    chain = chain.then(async () => {
      const temporary = `${path}.tmp`, file = await open(temporary, 'w', 0o600);
      try { await file.writeFile(serialized); await file.sync(); } finally { await file.close(); }
      await rename(temporary, path); await syncDirectory(path);
    });
    return chain;
  };
}
export function mutationGuard({ origin, evidence, checkpoint, expectedPrompt, expectedCreation }) {
  const allowed = new Set(['create', 'turn']);
  let conversationId, failed = false;
  assert.ok(expectedCreation?.executionProfile && expectedCreation.requested?.tools === 'none', 'Fixed creation profile required.');
  return async context => {
    await context.route('**/api/**', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== origin) return route.abort('blockedbyclient');
      if (request.method() === 'GET') return route.continue();
      const match = /^\/api\/conversations\/([^/]+)\/turns$/.exec(url.pathname);
      const kind = url.pathname === '/api/conversations' ? 'create' : match ? 'turn' : null;
      let body;
      try { body = JSON.parse(request.postData() ?? 'null'); } catch { body = null; }
      let creationMatches = true;
      if (kind === 'create') {
        try { assert.deepEqual({ harness: body?.harness, requested: body?.requested, executionProfile: body?.executionProfile }, expectedCreation); } catch { creationMatches = false; }
      }
      const blocked = failed || !creationMatches || request.method() !== 'POST' || !allowed.has(kind) || !request.headers()['idempotency-key']
        || kind === 'turn' && (allowed.has('create') || body?.text !== expectedPrompt || conversationId && match[1] !== conversationId);
      evidence.mutations.push({ path: url.pathname, method: request.method(), kind, blocked, at: new Date().toISOString() });
      if (blocked) { await checkpoint(); return route.abort('blockedbyclient'); }
      allowed.delete(kind); if (kind === 'turn') conversationId = match[1];
      // The permission is consumed and durably recorded before forwarding, including unknown outcomes.
      try { await checkpoint(); await route.continue(); } catch (error) { failed = true; throw error; }
    });
  };
}
export function recordGrowth(samples, sample, context) {
  assert.equal(context.finalObserved, false, 'A final reply cannot supply a draft growth sample.');
  assert.equal(context.taskStatus, 'running');
  if (!sample.id || !sample.text) return null;
  const prior = samples.get(sample.id) ?? [], previous = prior.at(-1);
  if (previous?.text === sample.text) return null;
  const record = { ...sample, ...context, bytes: Buffer.byteLength(sample.text), digest: sha256(sample.text), at: new Date().toISOString() };
  if (previous) assert.ok(sample.text.startsWith(previous.text) && record.bytes > previous.bytes, 'Visible draft must grow by strict prefix.');
  prior.push(record); samples.set(sample.id, prior); return record;
}
export const promptFor = nonce => `用四句短中文说明如何叠一只纸风筝，每句以序号开头，最后另起一行原样输出 ${nonce}。不用工具。`;
