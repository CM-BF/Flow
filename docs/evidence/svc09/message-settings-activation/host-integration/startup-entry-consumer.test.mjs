import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('/Users/citrine/Projects/AgentHarness/Flow/node_modules/typescript');
const root = fileURLToPath(new URL('../../../../../', import.meta.url));
const preimages = JSON.parse(readFileSync(new URL('./startup-progress-entry-inputs.json', import.meta.url))).preimages;
const parentRoot = '/Users/citrine/Projects/AgentHarness/Flow/';
const baseline = {};
for (const pin of preimages) {
  const data = readFileSync(parentRoot + pin.path);
  assert.equal(data.length, pin.bytes); assert.equal(createHash('sha256').update(data).digest('hex'), pin.sha256);
  baseline[pin.path.endsWith('main.ts') ? 'main' : 'index'] = data.toString();
}
const current = Object.fromEntries(['main', 'index', 'startup-progress'].map(name => [name, readFileSync(root + `apps/server/src/${name}.ts`, 'utf8')]));

/** Compile the actual entry files. Every external operation is explicitly synthetic. */
async function entry({ old = false, enabled = true, fail, cleanupFails = false, packageWorker = false, badConfig = false } = {}) {
  const trace = [], lines = [], hooks = {}, timers = [];
  const primary = Object.assign(Error('synthetic primary private text'), { code: '42P01' });
  const cleanup = Object.assign(Error('synthetic cleanup private text'), { code: 'EIO' });
  function operation(name) { trace.push(name); if (fail === name) throw primary; }
  const pool = { on() {}, query: async () => ({ rows: [] }), end: async () => { trace.push('pool.end'); if (cleanupFails) throw cleanup; } };
  const boss = { stop: async () => { trace.push('boss.stop'); } };
  const app = { log: { error() {} }, decorateRequest() {}, setErrorHandler() {}, get() {}, post() {},
    addHook(name, fn) { (hooks[name] ??= []).push(fn); },
    register: async () => { operation('cors'); },
    listen: async () => { for (const fn of hooks.onReady ?? []) await fn(); operation('listen'); return 'synthetic-listening'; },
    close: async () => { trace.push('close'); for (const fn of hooks.preClose ?? []) await fn(); for (const fn of hooks.onClose ?? []) await fn(); if (cleanupFails) throw cleanup; },
  };
  const env = { DATABASE_URL: badConfig ? undefined : 'synthetic-only', FLOW_TOKEN: 'synthetic-token', FLOW_ORIGIN: 'http://synthetic.invalid',
    ...(enabled ? { FLOW_STARTUP_DIAGNOSTICS: 'v1' } : {}) };
  const context = createContext({ Buffer, performance, process: { env, stderr: { write(line) { lines.push(line); return true; } }, on() {}, off() {}, exit() { throw Error('No process exit in synthetic entry'); } },
    setInterval(fn) { const timer = { fn, unref() {} }; timers.push(timer); return timer; }, clearInterval() {},
    setTimeout() { return { unref() {} }; }, clearTimeout() {} });
  const values = {
    default: () => app, MAX_BATCH_BYTES: 1048576, Pool: class { constructor() { return pool; } }, HttpError: class extends Error {},
    readPackageFetchConfiguration: async () => packageWorker ? {} : undefined,
    readPluginInstallationConfiguration: async () => undefined,
    readPluginRuntimeConfiguration: async () => undefined,
    parseActiveSteeringConfiguration: () => false,
    createBrowserSessionAuthentication: async () => { operation('authentication'); return {}; },
    startScheduler: async () => { operation('scheduler'); return boss; },
    startPackageFetchWorker: async () => { operation('package-worker'); return { stop: async () => { trace.push('worker.stop'); } }; },
    scanConversationQueue: async () => { operation('ready-conversation'); return { errors: [] }; },
    scanGoalProgressions: async () => { operation('ready-goal'); return { errors: [] }; },
  };
  const compiled = name => ts.transpileModule((old ? baseline[name] : current[name]) ?? current[name], { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText;
  const modules = new Map();
  function source(name) {
    if (modules.has(name)) return modules.get(name);
    const code = compiled(name), declarations = new Map();
    const ast = ts.createSourceFile(name, code, ts.ScriptTarget.ES2023, true, ts.ScriptKind.JS);
    for (const statement of ast.statements) if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause, names = [];
      if (clause?.name) names.push('default');
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) for (const item of clause.namedBindings.elements) names.push((item.propertyName ?? item.name).text);
      declarations.set(statement.moduleSpecifier.text, names);
    }
    const module = new SourceTextModule(code, { context, identifier: name });
    modules.set(name, module);
    module.dependencies = declarations;
    return module;
  }
  async function link(specifier, referencing) {
    if (specifier === './index.js') return source('index');
    if (specifier === './startup-progress.js') return source('startup-progress');
    const names = referencing.dependencies.get(specifier);
    return new SyntheticModule(names, function () {
      for (const name of names) {
        const fallback = name.startsWith('migrate') ? async () => operation(name) : () => { if (name === 'registerWorkspaceRoutes') operation('routes'); };
        this.setExport(name, Object.hasOwn(values, name) ? values[name] : fallback);
      }
    }, { context });
  }
  const main = source('main'); await main.link(link);
  let error;
  try { await main.evaluate(); } catch (caught) { error = caught; }
  const frames = lines.filter(line => line.startsWith('@flow-startup ')).map(line => JSON.parse(line.slice(14)));
  return { trace, lines, frames, error, primary, cleanup, timers, hooks };
}

test('actual main/index observer preserves default operation order and emits the full startup boundaries', async () => {
  const before = await entry({ old: true }), disabled = await entry({ enabled: false }), observed = await entry();
  assert.equal(before.error, undefined); assert.equal(disabled.error, undefined); assert.equal(observed.error, undefined);
  assert.deepEqual(disabled.trace, before.trace); assert.deepEqual(observed.trace, before.trace);
  assert.equal(disabled.lines.length, 0);
  const migrations = observed.trace.filter(name => name.startsWith('migrate'));
  assert.equal(migrations.length, 31);
  assert.deepEqual(observed.frames.filter(frame => frame.e === 'enter' && frame.p.startsWith('migrate')).map(frame => frame.p), migrations);
  for (const phase of ['configuration', 'authentication', 'cors', 'scheduler', 'routes', 'ready-conversation', 'ready-goal', 'listen']) {
    assert.equal(observed.frames.filter(frame => frame.p === phase && frame.e === 'enter').length, 1);
    assert.equal(observed.frames.filter(frame => frame.p === phase && frame.e === 'settled').length, 1);
  }
  assert.equal(observed.frames.at(-1).e, 'complete'); assert.equal(observed.frames.at(-1).outcome, 'listening');
  assert.ok(observed.frames.length <= 128); assert.ok(Buffer.byteLength(observed.lines.join('')) <= 8192);
  const count = observed.frames.length;
  await observed.hooks.onReady[0]();
  assert.equal(observed.lines.length, count); // Later scans cannot extend a completed startup stream.
});

for (const phase of ['migrateGoals', 'authentication', 'scheduler', 'package-worker', 'routes', 'listen']) {
  test(`actual entry retains the original ${phase} failure before existing cleanup`, async () => {
    const before = await entry({ old: true, fail: phase, packageWorker: true });
    const observed = await entry({ fail: phase, packageWorker: true });
    assert.equal(observed.error, observed.primary); assert.equal(before.error, before.primary);
    assert.deepEqual(observed.trace, before.trace);
    assert.ok(observed.frames.some(frame => frame.p === phase && frame.e === 'error' && frame.c === '42P01'));
    assert.equal(observed.frames.at(-1).outcome, 'failed');
    assert.ok(!observed.lines.join('').includes('private text'));
  });
}

test('actual migration cleanup failure does not erase the prior structural diagnostic or change old throw semantics', async () => {
  const before = await entry({ old: true, fail: 'migrate', cleanupFails: true });
  const observed = await entry({ fail: 'migrate', cleanupFails: true });
  assert.equal(before.error, before.cleanup); assert.equal(observed.error, observed.cleanup);
  assert.deepEqual(observed.trace, before.trace);
  assert.ok(observed.frames.some(frame => frame.p === 'migrate' && frame.e === 'error' && frame.c === '42P01'));
  assert.equal(observed.frames.at(-1).outcome, 'failed');
});

test('actual configuration rejection has no migration or service side effects and produces a failed stream', async () => {
  const before = await entry({ old: true, badConfig: true });
  const observed = await entry({ badConfig: true });
  assert.ok(before.error); assert.ok(observed.error); assert.deepEqual(observed.trace, []);
  assert.ok(observed.frames.some(frame => frame.p === 'configuration' && frame.e === 'error'));
  assert.equal(observed.frames.at(-1).outcome, 'failed');
});
