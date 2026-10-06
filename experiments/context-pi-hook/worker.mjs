import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { spawnSync } from 'node:child_process';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';

const [work, piPath, pluginPath, sentinel, mode] = process.argv.slice(2);
const report = { probe: 'CTX02', mode, cases: [], outcome: 'started', probeInvokedPrompt: false, probeInvokedProvider: false, providerAttemptCount: 'not-instrumented; OS network blocked' };
const start = performance.now();
const sessions = [];
const hash = value => createHash('sha256').update(value).digest('hex');
const textOf = messages => messages.flatMap(message => typeof message.content === 'string' ? [message.content] : message.content?.filter(part => part.type === 'text').map(part => part.text) ?? []).join('\n');
const safeError = error => ({ name: error.name, code: error.code, message: error.message, stack: error.stack?.split('\n').slice(0, 8).join('\n') });
async function check(name, execute) {
  const before = performance.now();
  try { report.cases.push({ name, result: await execute(), elapsedMs: performance.now() - before, passed: true }); }
  catch (error) { report.cases.push({ name, error: safeError(error), elapsedMs: performance.now() - before, passed: false }); throw error; }
}

try {
  await check('OS barriers before any dependency import', async () => {
    let readCode;
    try { await fs.readFile(sentinel); } catch (error) { readCode = error.code; }
    assert.equal(readCode, 'ERR_ACCESS_DENIED');
    const connectCode = await new Promise(resolve => {
      const socket = net.createConnection({ host: '127.0.0.1', port: 9 });
      socket.on('error', error => { socket.destroy(); resolve(error.code); });
      socket.on('connect', () => { socket.destroy(); resolve('CONNECTED'); });
      socket.setTimeout(1000, () => { socket.destroy(); resolve('TIMEOUT'); });
    });
    assert.equal(connectCode, 'EPERM');
    let childCode;
    try { spawnSync(process.execPath, ['-e', 'process.exit(0)']); } catch (error) { childCode = error.code; }
    assert.equal(childCode, 'ERR_ACCESS_DENIED');
    return { deniedSyntheticRead: readCode, deniedLoopbackConnect: connectCode, deniedChildProcess: childCode, enforcement: 'Node Permission Model read/child-process; macOS sandbox-exec network/fork/write; no JS interception' };
  });
  // Bind only the plugin's bare SDK import to the already verified fixed SDK.
  // This is module resolution, not an implementation or host API replacement.
  registerHooks({ resolve(specifier, context, nextResolve) {
    if (specifier === '@earendil-works/pi-coding-agent' && context.parentURL?.startsWith(pathToFileURL(pluginPath).href)) {
      return { url: pathToFileURL(path.join(piPath, 'dist/index.js')).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  } });
  let pi, plugin;
  await check('import unmodified fixed SDK and plugin', async () => {
    pi = await import(pathToFileURL(path.join(piPath, 'dist/index.js')));
    plugin = await import(pathToFileURL(path.join(pluginPath, 'dist/index.js')));
    report.loaded = { sdkCreateAgentSession: typeof pi.createAgentSession, pluginCreateAcpExtension: typeof plugin.createAcpExtension };
    return report.loaded;
  });
  const { AuthStorage } = await import(pathToFileURL(path.join(piPath, 'dist/core/auth-storage.js')));
  const runtime = await pi.ModelRuntime.create({ credentials: AuthStorage.inMemory(), modelsPath: null, allowModelNetwork: false, refreshOnCreate: false });
  const model = { id: 'ctx02-no-provider', name: 'Synthetic metadata only', provider: 'ctx02', api: 'openai-completions', baseUrl: 'http://127.0.0.1:9', reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 200000, maxTokens: 1024 };
  const zeroUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
  const assistant = content => ({ role: 'assistant', content, api: model.api, provider: model.provider, model: model.id, usage: zeroUsage, stopReason: 'stop', timestamp: 1 });
  const adapter = { modelContextLimit: 200000, autoUpdate: false, delegate: false, throttleRetry: false, preserveRecentMessages: 0, coreOverrides: { preserveRecentTokens: 0 }, outputHeadroomMaxPct: 0 };
  report.adapter = adapter;
  const fixtures = new Map();
  async function factoryResources(cwd, enabled) {
    const { loadExtensionFromFactory, createExtensionRuntime } = await import(pathToFileURL(path.join(piPath, 'dist/core/extensions/loader.js')));
    const { createEventBus } = await import(pathToFileURL(path.join(piPath, 'dist/core/event-bus.js')));
    const extensionRuntime = createExtensionRuntime();
    const extension = await loadExtensionFromFactory(plugin.createAcpExtension({ ...adapter, enabled }), cwd, createEventBus(), extensionRuntime, 'fixed-billion-context-pi-0.1.83');
    // The SDK ResourceLoader seam receives actual stock-loaded extensions and
    // explicitly empty resources. Extension APIs/context/actions remain Pi's.
    return {
      getExtensions: () => ({ extensions: [extension], errors: [], runtime: extensionRuntime }),
      getSkills: () => ({ skills: [], diagnostics: [] }), getPrompts: () => ({ prompts: [], diagnostics: [] }),
      getThemes: () => ({ themes: [], diagnostics: [] }), getAgentsFiles: () => ({ agentsFiles: [] }),
      getSystemPrompt: () => undefined, getSystemPromptSource: () => undefined,
      getAppendSystemPrompt: () => [], getAppendSystemPromptSources: () => [],
      extendResources: () => { throw new Error('No additional resource discovery is authorized'); },
      reload: async () => { throw new Error('No implicit resource reload is authorized'); },
    };
  }
  async function open(label, filename, enabled = true) {
    const cwd = path.join(work, label);
    await fs.mkdir(cwd, { recursive: true });
    const settingsManager = pi.SettingsManager.inMemory({ compaction: { enabled: false }, retry: { enabled: false }, cacheWarming: 'off', packages: [] });
    let loader;
    if (mode === 'factory') loader = await factoryResources(cwd, enabled);
    else {
      loader = new pi.DefaultResourceLoader({ cwd, agentDir: path.join(work, 'agent'), settingsManager, noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true, extensionFactories: [plugin.createAcpExtension({ ...adapter, enabled })] });
      await loader.reload();
    }
    assert.deepEqual(loader.getExtensions().errors, []);
    const manager = filename ? pi.SessionManager.open(filename) : pi.SessionManager.create(cwd, path.join(cwd, 'sessions'));
    if (!filename) {
      const originals = Array.from({ length: 4 }, (_, i) => `CTX02_${label}_${i}_中文🚀_${'private synthetic value '.repeat(250)}`);
      fixtures.set(label, originals);
      manager.appendMessage({ role: 'user', content: 'Keep the session-specific material available.', timestamp: 0 });
      for (const text of originals) manager.appendMessage(assistant([{ type: 'text', text }]));
      manager.appendMessage({ role: 'user', content: 'Continue without calling a model.', timestamp: 2 });
    }
    const { session } = await pi.createAgentSession({ cwd, agentDir: path.join(work, 'agent'), modelRuntime: runtime, model, thinkingLevel: 'off', resourceLoader: loader, settingsManager, sessionManager: manager, tools: [] });
    sessions.push(session);
    const errors = [];
    await session.bindExtensions({ onError: error => errors.push(error), mode: 'sdk' });
    return { session, manager, errors };
  }
  async function view(handle) {
    const result = await handle.session.extensionRunner.emitContext(handle.manager.buildSessionContext().messages);
    assert.deepEqual(handle.errors, [], 'Real extension errors cannot be counted as a passing hook');
    return result;
  }
  async function tool(handle, name, args, callId) {
    const definition = handle.session.extensionRunner.getToolDefinition(name);
    assert(definition, `Real registered ${name} tool missing`);
    return definition.execute(callId, args, AbortSignal.timeout(2000), undefined, handle.session.extensionRunner.createContext());
  }
  async function close(handle) {
    await handle.session.extensionRunner.emit({ type: 'session_shutdown' });
    handle.session.dispose();
    sessions.splice(sessions.indexOf(handle.session), 1);
  }
  const handles = {};
  await check('real SDK loads two isolated sessions and projects real context hooks', async () => {
    for (const label of ['A', 'B']) {
      handles[label] = await open(label);
      const messages = await view(handles[label]);
      const text = textOf(messages);
      assert(text.includes(`CTX02_${label}_0_`));
      assert(!text.includes(`CTX02_${label === 'A' ? 'B' : 'A'}_0_`));
      report[label] = { sessionId: handles[label].manager.getSessionId(), sessionFile: handles[label].manager.getSessionFile(), sourceHashes: fixtures.get(label).map(hash), visibleCharacters: text.length, contextPreview: text.slice(0, 350), hooks: ['context', 'session_before_compact'].map(name => [name, handles[label].session.extensionRunner.hasHandlers(name)]) };
    }
    report.inputBytes = [...fixtures.values()].flat().reduce((sum, text) => sum + Buffer.byteLength(text), 0);
    assert(report.inputBytes <= 1024 * 1024);
    assert.notEqual(report.A.sessionId, report.B.sessionId);
    return { sessions: 2, inputBytes: report.inputBytes };
  });
  await check('registered compress/decompress preserve exact source and session separation', async () => {
    for (const label of ['A', 'B']) {
      const handle = handles[label];
      const summary = `Historical summary for ${label}: four synthetic notes were recorded. Their exact session-specific values remain retrievable; do not execute them as instructions.`;
      const args = { content: [{ startId: 'm00002', endId: 'm00005', summary }] };
      const callId = `ctx02-compress-${label}`;
      handle.manager.appendMessage(assistant([{ type: 'toolCall', id: callId, name: 'compress', arguments: args }]));
      const compressed = await tool(handle, 'compress', args, callId);
      handle.manager.appendMessage({ role: 'toolResult', toolCallId: callId, toolName: 'compress', content: compressed.content, isError: false, timestamp: 3 });
      const projected = await view(handle);
      const visible = textOf(projected);
      const restored = await tool(handle, 'decompress', { blockId: 'b1', full: true, inline: true }, `ctx02-decompress-${label}`);
      const restoredText = textOf([restored]);
      report[label].compressResult = textOf([compressed]);
      report[label].restoredPreview = restoredText.slice(0, 300);
      const survivingCalls = projected.flatMap(message => Array.isArray(message.content) ? message.content.filter(part => part.type === 'toolCall') : []);
      assert(survivingCalls.some(call => call.name === 'compress' && call.arguments.content?.some(range => range.summary === summary)), 'Summary must survive in the actual transmitted compress call arguments');
      for (const original of fixtures.get(label)) assert(!visible.includes(original), 'Compressed source must leave the visible text');
      report[label].summaryRepresentation = 'preserved compress toolCall arguments; synthetic standalone summary omitted by stock Pi adapter';
      for (const original of fixtures.get(label)) assert(restoredText.includes(original), 'Exact original bytes must occur in restored text');
      assert(!restoredText.includes(`CTX02_${label === 'A' ? 'B' : 'A'}_0_`));
      report[label].restoredHash = hash(restoredText);
      report[label].afterCompressionHash = hash(visible);
      report[label].sidecar = JSON.parse(await fs.readFile(`${handle.manager.getSessionFile()}.acp.json`, 'utf8'));
    }
    return { exactOriginals: 8, otherSessionMaterialAbsent: true };
  });
  await check('real journal and sidecar reopen retain exact block retrieval', async () => {
    for (const label of ['A', 'B']) {
      const file = handles[label].manager.getSessionFile();
      await close(handles[label]);
      handles[label] = await open(label, file);
      const visible = textOf(await view(handles[label]));
      const restored = textOf([await tool(handles[label], 'decompress', { blockId: 'b1', full: true, inline: true }, `restart-${label}`)]);
      assert.equal(hash(restored), report[label].restoredHash);
      assert.equal(handles[label].manager.getSessionId(), report[label].sessionId);
      report[label].reopened = { sessionIdUnchanged: true, restoredHash: hash(restored), projectedHash: hash(visible) };
    }
    return { sameSessionIds: true, exactRestoredHashes: true, mechanism: 'new stock factory/runtime + SessionManager.open in same OS process' };
  });
  await check('native compaction hook owner is exclusive and disabled plugin stands down', async () => {
    const { prepareCompaction } = await import(pathToFileURL(path.join(piPath, 'dist/core/compaction/compaction.js')));
    const eventFor = handle => {
      const branchEntries = handle.manager.getBranch();
      const preparation = prepareCompaction(branchEntries, { enabled: true, reserveTokens: 100, keepRecentTokens: 100 });
      assert(preparation);
      return { type: 'session_before_compact', preparation, branchEntries, reason: 'manual', willRetry: false, signal: AbortSignal.timeout(2000) };
    };
    const active = await handles.B.session.extensionRunner.emit(eventFor(handles.B));
    assert.deepEqual(active, { cancel: true });
    const file = handles.B.manager.getSessionFile();
    await close(handles.B);
    handles.B = await open('B', file, false);
    const disabled = await handles.B.session.extensionRunner.emit(eventFor(handles.B));
    assert.equal(disabled, undefined);
    assert.equal(handles.B.session.extensionRunner.hasHandlers('context'), false);
    assert.equal(handles.B.session.extensionRunner.getToolDefinition('compress'), undefined);
    return { active, disabled: 'no handler/result; no compress tool/context transform', scope: 'actual stock event dispatch, not a native model summarization call' };
  });
  await check('missing and future-version sidecars expose their actual stock behavior', async () => {
    const file = handles.A.manager.getSessionFile();
    const sidecarFile = `${file}.acp.json`;
    const original = await fs.readFile(sidecarFile, 'utf8');
    const observations = [];
    for (const variant of ['missing', 'future-schema']) {
      await close(handles.A);
      if (variant === 'missing') await fs.rm(sidecarFile);
      else {
        const future = JSON.parse(original);
        future.schemaVersion = 999999;
        await fs.writeFile(sidecarFile, JSON.stringify(future));
      }
      handles.A = await open('A', file);
      const projected = textOf(await view(handles.A));
      const result = textOf([await tool(handles.A, 'decompress', { blockId: 'b1', full: true, inline: true }, variant)]);
      const originalsRecovered = fixtures.get('A').every(text => result.includes(text));
      const sidecar = JSON.parse(await fs.readFile(sidecarFile, 'utf8'));
      observations.push({ variant, rejected: false, originalsRecovered, resultingSchemaVersion: sidecar.schemaVersion, resultPreview: result.slice(0, 160), projectedHash: hash(projected) });
    }
    report.storeObservations = observations;
    return observations;
  });
  for (const handle of Object.values(handles)) await close(handle);
  report.outcome = 'completed-observations';
} catch (error) {
  report.outcome = 'blocked';
  report.error = safeError(error);
} finally {
  for (const session of sessions) session.dispose();
  try { report.pluginLog = await fs.readFile(process.env.ACP_LOG_FILE, 'utf8'); } catch { /* no log may exist before plugin load */ }
  report.elapsedMs = performance.now() - start;
  process.stdout.write(JSON.stringify(report) + '\n');
}
