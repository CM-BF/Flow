/** Offline cross-check only; the independent CI owner must supply observed exit/cleanup provenance. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const [output, receiptPath, trustedReceiptSha256, expectedSource, expectedRun] = process.argv.slice(2);
assert.equal(process.argv.length, 7);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function read(path, cap = 262144) {
  const stat = lstatSync(path); assert(stat.isFile() && !stat.isSymbolicLink() && stat.size <= cap);
  return readFileSync(path);
}
assert(/^[a-f0-9]{64}$/.test(trustedReceiptSha256) && /^[a-f0-9]{40}$/.test(expectedSource));
const receiptBytes = read(receiptPath); assert.equal(hash(receiptBytes), trustedReceiptSha256);
const receipt = JSON.parse(receiptBytes), bytes = read(join(output, 'result.json')), result = JSON.parse(bytes);
assert.equal(receipt.sourceCommit, expectedSource); assert.equal(receipt.runId, expectedRun);
assert.equal(receipt.actualOuterExitCode, 0); assert.equal(receipt.runResultSha256, hash(bytes));
assert.deepEqual(receipt.terminal, { contract: 'msgquick-portable-v1', runId: expectedRun, sourceCommit: expectedSource,
  state: 'CHECKS_PASSED_PENDING_CLEANUP', resultSha256: hash(bytes) });
assert.equal(receipt.terminalCount, 1, 'Exactly one complete observed terminal line required');
assert(Number.isSafeInteger(receipt.elapsedMs) && Number.isSafeInteger(receipt.authorizedTotalMs)
  && receipt.elapsedMs >= 0 && receipt.elapsedMs <= receipt.authorizedTotalMs, 'Outer deadline observation required');
assert.equal(receipt.cleanup.state, 'complete'); assert.equal(receipt.cleanup.ownedProcessesAbsent, true);
assert.equal(receipt.cleanup.scratchAbsent, true); assert.deepEqual(receipt.cleanup.errors, []);
assert(Number.isFinite(Date.parse(receipt.observedAt)), 'Independent observation time required');
assert.equal(result.contract, 'msgquick-portable-v1'); assert.equal(result.sourceCommit, expectedSource); assert.equal(result.runId, expectedRun);
assert.equal(result.state, 'CHECKS_PASSED_PENDING_CLEANUP'); assert.deepEqual(result.errors, []);
assert(Number.isSafeInteger(result.elapsedMs) && result.elapsedMs >= 0 && result.elapsedMs <= result.workMs
  && result.workMs > 0 && result.workMs <= 120000 && result.elapsedMs <= receipt.elapsedMs);
assert.deepEqual(result.steps.map(step => step.name), ['strict-noEmit', 'direct']);
assert(result.steps.every(step => step.exitCode === 0 && step.signal === null && step.error === null && !step.outputTruncated));
const names = Object.keys(result.files).sort();
assert.deepEqual(names, ['direct.log', 'input-manifest.json', 'strict-noEmit.log', 'vitest-results.json']);
let retainedBytes = bytes.length + receiptBytes.length;
for (const name of names) { const raw = read(join(output, name), name.endsWith('.log') ? 524288 : 262144); retainedBytes += raw.length; assert.equal(hash(raw), result.files[name]); }
assert(retainedBytes <= 2 * 1024 * 1024, 'Bounded evidence exceeded');
console.log(JSON.stringify({ state: 'CHECKS_AND_EXTERNAL_RECEIPT_MATCH', sourceCommit: expectedSource, runId: expectedRun,
  resultSha256: hash(bytes), independentReceiptSha256: trustedReceiptSha256, browser: 'NOT_RUN' }));
// Exit0 certifies consistency, not authenticity of caller-supplied facts or authorization to run another task.
