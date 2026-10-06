// Fixed three-stage composition. R06 alone owns target processes and stdio.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createCodexTransport } from '../../../apps/runner/src/codex/index.ts';
import { runSyntheticCanary } from '../isolation/compose-canary.mjs';
import { durableCreate, identity, sameIdentity, safeClose, makePrivateSink, finalizeFile, publicArtifact, captureComplete, cleanupPrivate } from '../diagnostics/run-diagnostics.mjs';
import { observeRuntimeArtifact } from '../node-runtime-metadata/observe.mjs';

const stages = Object.freeze(['node-control', 'node-profile-control', 'node-canary']);
const controlHash = 'ca5c7bbdd4599b7cb7154d4895952561b9f7e94d48d84dba22c898910af1130c';
const fail = () => { throw Error('Bounded Node probe unavailable'); };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function makeNodeBudget(prepared) {
  if (!Number.isSafeInteger(prepared) || prepared < 0 || prepared > 1048576) fail();
  const counts = { prepared, captured: 0, diskCopies: 0, stdoutSourceUpperBound: 0, receipts: 0 };
  const reserved = () => prepared + counts.captured + counts.diskCopies + counts.stdoutSourceUpperBound + 32768 + 131072;
  return {
    add(kind, bytes) {
      if (!Object.hasOwn(counts, kind) || kind === 'prepared' || !Number.isSafeInteger(bytes) || bytes < 0) fail();
      counts[kind] += bytes;
      if (reserved() > 2097152 || counts.receipts > 32768) fail();
    },
    canStart() { return reserved() + 2 * 65536 + 65536 + 182 <= 2097152; },
    snapshot() { return { ...counts, measuredBytes: Object.values(counts).reduce((a, b) => a + b, 0),
      archiveReserveBytes: 131072, receiptReserveBytes: 32768, limit: 2097152, reservedBytes: reserved() }; },
  };
}

/** Caller must verify fixed inputs. Dependency injection is test-only; CLI has no arbitrary factory/path flags. */
export async function runNodeRootliteralBatch({ evidenceDirectory, peerBytes, preparedEvidenceBytes, recipe = 'rootliteral-three', roles = [] }, dependencies = {}) {
  if (!['rootliteral-three', 'runtime-metadata-canary-only'].includes(recipe)) fail();
  const selectedStages = recipe === 'runtime-metadata-canary-only' ? ['node-runtime-metadata-canary'] : stages;
  const now = dependencies.now ?? (() => performance.now());
  const start = dependencies.start ?? now(); const startedAt = dependencies.startedAt ?? new Date().toISOString();
  const factory = dependencies.createTransport ?? createCodexTransport;
  const compose = dependencies.compose ?? runSyntheticCanary;
  const budget = makeNodeBudget(preparedEvidenceBytes);
  budget.add('receipts', dependencies.initialReceiptBytes ?? 0);
  const elapsed = () => now() - start;
  const persist = (name, value) => {
    budget.add('receipts', Buffer.byteLength(`${JSON.stringify(value, null, 2)}\n`));
    durableCreate(path.join(evidenceDirectory, name), value);
  };
  // Reservation failure escapes before any private resource or target can be created.
  persist('batch-reservation.json', { startedAt, maxTargets: selectedStages.length, maxCompile: 0, totalMs: 60000, consumed: true, ...(recipe === 'runtime-metadata-canary-only' ? { window: 'go-node-runtime-metadata-once' } : {}) });
  const result = { startedAt, targets: selectedStages.map(() => 'NOT_RUN'), factoryCalls: 0,
    compileCalls: 0, codexStarts: 0, providerCalls: 0, stages: [], cleanupComplete: false, outputAccountingComplete: false };
  const owned = []; const inventories = [];
  let privateRoot; let rootIdentity; let active; let sink; let timer; let abort;
  let allChildrenClosed = true; let allCompositionsClean = true; let allInventoriesComplete = true; let allCapturesComplete = true;
  let allStdoutBoundsConfirmed = true;
  let allObserverDescriptorsClosed = true; let compositionPending = false;
  try {
    privateRoot = fs.mkdtempSync('/private/tmp/flow-wpf02-private-'); // Path owned before lstat/chmod can fail.
    rootIdentity = identity(privateRoot); fs.chmodSync(privateRoot, 0o700);
    for (const [index, stage] of selectedStages.entries()) {
      const canary = stage === 'node-canary' || stage === 'node-runtime-metadata-canary';
      if (elapsed() >= 45000 || !budget.canStart()) { result.stopReason = 'budget-insufficient'; break; }
      let called = false; let returned; let close = null; let captured = null; let deliveredBytes = 0;
      const priorClean = allCompositionsClean, priorStdout = allStdoutBoundsConfirmed;
      allCompositionsClean = false; allStdoutBoundsConfirmed = false; // Pending until an explicit composition receipt.
      try {
        compositionPending = true;
        returned = await compose(options => {
          if (called || active || result.factoryCalls !== index || elapsed() >= 45000) fail();
          called = true;
          const expectedExecutable = stage === 'node-control' ? '/opt/homebrew/Cellar/node@24/24.20.0/bin/node' : '/usr/bin/sandbox-exec';
          if (options.spawn.executable !== expectedExecutable) fail();
          const directory = path.join(path.dirname(options.spawn.cwd), 'control');
          const copies = fs.readdirSync(directory).sort().map(name => {
            const file = path.join(directory, name), stat = fs.lstatSync(file);
            const maxBytes = stage === 'node-runtime-metadata-canary' && name === 'default-deny.sb' ? 32768 : 16384;
            if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maxBytes) fail();
            return { name, bytes: stat.size, sha256: hash(fs.readFileSync(file)) };
          });
          sink = makePrivateSink(privateRoot, index + 1, owned, controlHash, {
            observe: bytes => { deliveredBytes += bytes; budget.add('captured', bytes); }, persist: bytes => budget.add('diskCopies', bytes),
          });
          budget.add('stdoutSourceUpperBound', canary ? 182 : 0);
          persist(`slot-${index + 1}.json`, { number: index + 1, stage, at: new Date().toISOString(), elapsedMs: elapsed(), copies,
            commandSha256: hash(Buffer.from(JSON.stringify(options.spawn))), stdoutSourceUpperBound: canary ? 182 : 0 });
          result.targets[index] = 'ATTEMPTED'; result.factoryCalls++; allChildrenClosed = false;
          abort = new AbortController(); timer = setTimeout(() => abort.abort(), 8000);
          active = factory({ ...options, signal: abort.signal, privateStderr: sink.option });
          return active;
        }, { r06Target: 'a239b14d5328c78cca02a8757e26f2b65502f926', peerBytes, scenario: stage });
        compositionPending = false;
      } finally {
        if (active) { try { close = safeClose(await active.close()); } catch { /* Unknown is retained. */ } }
        clearTimeout(timer); active = undefined;
        if (sink) { captured = sink.finish(); sink = undefined; }
        const observed = close?.stderrCapture?.observedBytes;
        if (Number.isSafeInteger(observed) && observed > deliveredBytes) budget.add('captured', observed - deliveredBytes);
      }
      const captureOk = Boolean(captured && captureComplete(close, captured));
      allStdoutBoundsConfirmed = priorStdout && returned?.stdoutBoundConfirmed === true;
      const childClosed = result.factoryCalls <= index || close?.child === 'confirmed-exited';
      allChildrenClosed = Boolean(childClosed); allCapturesComplete &&= captureOk;
      const clean = returned?.listenerClosed === true && returned?.retainedRoots?.length === 0;
      allCompositionsClean = priorClean && clean;
      const inventory = returned?.outputInventory;
      allInventoriesComplete &&= inventory?.complete === true;
      if (inventory?.complete) { budget.add('diskCopies', inventory.bytes); inventories.push({ stage, ...inventory }); }
      const expected = !canary ? close?.exitCode === 7 && close?.signal === null && captured?.bytes === 40 && captured?.sha256 === controlHash
        : captured?.bytes === 0 && returned?.report?.passed === true;
      const runtimeObservation = recipe === 'runtime-metadata-canary-only' ? observeRuntimeArtifact(captured, close, roles) : null;
      const observerConfirmed = runtimeObservation?.descriptorClosed !== false && runtimeObservation?.sourceConfirmed !== false;
      if (runtimeObservation?.descriptorClosed === false) allObserverDescriptorsClosed = false;
      allCapturesComplete &&= observerConfirmed;
      const passed = returned?.passed === true && returned?.stdoutBoundConfirmed === true && expected && childClosed && captureOk && clean && inventory?.complete === true
        && observerConfirmed && (recipe !== 'runtime-metadata-canary-only' || close?.reason === 'CLOSED');
      if (recipe === 'runtime-metadata-canary-only') allStdoutBoundsConfirmed = priorStdout && passed && close?.reason === 'CLOSED';
      result.targets[index] = passed ? 'EXPECTED' : childClosed ? 'FAILED' : 'UNKNOWN';
      const { outputInventory, ...observation } = returned ?? {};
      result.stages.push({ stage, close, capture: captured, observation, passed, ...(runtimeObservation ? { runtimeObservation } : {}) });
      persist(`result-${index + 1}.json`, { stage, passed, childClosed, captureComplete: captureOk, cleaned: clean, elapsedMs: elapsed() });
      if (!passed) { result.stopReason = 'stage-failed-or-unknown'; break; }
    }
  } catch { result.stopReason = 'preparation-observation-or-persistence-failed'; allInventoriesComplete = false; }
  finally {
    abort?.abort(); clearTimeout(timer);
    if (active) { try { await active.close(); } catch { /* Retain unknown. */ } allChildrenClosed = false; }
    for (const record of owned) finalizeFile(record, controlHash);
    // Private cwd/raw may still be reachable by an unsettled target. Never delete on a mere timeout.
    const cleanup = allChildrenClosed && allCompositionsClean && allObserverDescriptorsClosed
      ? cleanupPrivate(privateRoot, rootIdentity, null, owned)
      : { privateRootRemoved: false, retained: privateRoot ? [privateRoot] : [] };
    result.privateArtifacts = owned.map(publicArtifact); result.privateCleanup = cleanup;
    result.retainedRootsComplete = !compositionPending && result.stages.every(row => Array.isArray(row.observation?.retainedRoots));
    result.cleanupComplete = allChildrenClosed && allCompositionsClean && allObserverDescriptorsClosed && cleanup.privateRootRemoved && owned.every(x => x.close && x.removed);
    result.stdoutBoundsConfirmed = allStdoutBoundsConfirmed;
    result.outputAccountingComplete = allInventoriesComplete && allCapturesComplete && allChildrenClosed && allStdoutBoundsConfirmed && allObserverDescriptorsClosed;
    result.measurementComplete = result.targets.every(x => x === 'EXPECTED');
    result.requiresHostExit = !allChildrenClosed;
    result.endedAt = new Date().toISOString(); result.elapsedMs = elapsed(); result.elapsedBasis = 'before-inventory-and-result-persistence';
    try {
      persist('runtime-inventory.json', { inventories, privateArtifacts: result.privateArtifacts,
        stdoutBasis: recipe === 'runtime-metadata-canary-only' ? '182 byte conservative source bound qualifies only after strict normal canary completion; not wire capture' : 'fixed-source 0/0/182 upper bounds; not an independent wire byte counter' });
      result.inventoryPersisted = true;
      result.output = budget.snapshot(); result.withinBudgetBeforePersistence = elapsed() <= 60000;
      persist('batch-result.json', result); result.resultPersisted = true;
    } catch (error) {
      if (recipe !== 'runtime-metadata-canary-only') throw error;
      result.resultPersisted = false; result.outputAccountingComplete = false;
      result.stopReason = 'final-persistence-failed';
    }
    result.output = budget.snapshot(); result.finalElapsedMs = elapsed(); result.withinBudget = result.resultPersisted === true && elapsed() <= 60000;
  }
  return result;
}
