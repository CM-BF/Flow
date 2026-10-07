import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm';
import { validateHostInput } from './host-consumer.mjs';

test('cold fixture explicit legacy configuration reaches the original database-intent boundary without loading slots', async () => {
  const url = new URL('./host-fixture.mjs', import.meta.url), files = new Map(), created = [];
  const context = createContext({ Buffer, URL });
  let port = 45000;
  const module = new SourceTextModule(await readFile(url, 'utf8'), { context, identifier: url.href,
    importModuleDynamically: () => { throw Error('No slot or runtime module may be imported before this boundary'); } });
  await module.link(async specifier => {
    let values = await import(specifier);
    if (specifier === 'node:fs/promises') values = { ...values, mkdir: async path => created.push(path), open: async (path, flags) => ({
      writeFile: async bytes => { assert.equal(flags, 'wx'); assert.ok(!files.has(path)); files.set(path, Buffer.from(bytes)); },
      sync: async () => {}, close: async () => {},
    }) };
    if (specifier === 'node:net') values = { createServer: () => {
      const server = { once: () => server, listen: (_port, _host, done) => done(), address: () => ({ port: ++port }), close: done => done() }; return server;
    } };
    return new SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value); }, { context });
  });
  await module.evaluate();
  const nativeConfiguration = { model: 'claude-sonnet-5-5', materialFiles: [], allowRead: false, requireReadApproval: false,
    maxTurns: 2, maxBudgetUsd: 0.20, timeoutMs: 60000 };
  const sentinel = new Error('Stop before pool construction');
  await assert.rejects(module.namespace.setupFixture({ input: { directory: '/synthetic/private', repository: '/synthetic/source', artifact: { fixed: true }, sourceHead: 'a'.repeat(40) },
    root: '/synthetic/artifact', adminUrl: 'postgres://synthetic@127.0.0.1/postgres',
    checkpoint: async phase => { assert.equal(phase, 'database-create-intent'); throw sentinel; } }, { nativeConfiguration }), error => error === sentinel);
  assert.deepEqual(JSON.parse(files.get('/synthetic/private/claude.json')), nativeConfiguration);
  assert.equal(files.size, 3); assert.deepEqual(created, ['/synthetic/private/runner']);
});
test('cold fixed input removes only the settings recipe requirement and keeps identity validation', () => {
  const input = { format: 1, directory: '/private/tmp/flow-svc09a-host-cold_1', sourceHead: 'a'.repeat(40), repository: '/fixed/repository',
    artifact: { artifactId: 'b'.repeat(64), manifestDigest: 'b'.repeat(64), sourceHead: 'a'.repeat(40) } };
  assert.throws(() => validateHostInput(input), { code: 'HOST_FIXED_INPUT_REQUIRED' });
  assert.equal(validateHostInput(input, { requiresSettings: false }), input.directory + '/backend-artifacts/' + input.artifact.artifactId + '/root');
  assert.throws(() => validateHostInput({ ...input, directory: '/outside' }, { requiresSettings: false }), { code: 'HOST_FIXED_INPUT_REQUIRED' });
  assert.throws(() => validateHostInput({ ...input, artifact: { ...input.artifact, sourceHead: 'c'.repeat(40) } }, { requiresSettings: false }), { code: 'HOST_FIXED_INPUT_REQUIRED' });
});
