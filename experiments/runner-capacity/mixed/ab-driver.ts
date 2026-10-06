import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { directoryBytes } from '../evidence.js';
import { beforeDeadline } from './deadline.js';
import { COMPARISON, ComparisonBudget } from './ab-budget.js';
import { checkDisk, exportInputs } from './ab-input.js';
import { compareSides, type SideOutcome } from './ab-sequence.js';
import { runMixed } from './driver.js';

export async function runComparison(windowId: string, target: string, started = performance.now()) {
  const budget = new ComparisonBudget(started); const output = resolve(COMPARISON.output);
  assert.equal(windowId, COMPARISON.windowId, 'Unexpected comparison window identity.');
  assert(/^[a-f0-9]{40}$/.test(target), 'Exact execution target required.');
  const preparationDeadline = started + COMPARISON.preparationMs;
  const git = (...args: string[]) => {
    budget.work(); const result = execFileSync('git', args, { encoding: 'utf8', timeout: Math.max(1, Math.min(5000, preparationDeadline - performance.now())), maxBuffer: 1024 * 1024 });
    budget.chargeCommon('git-preflight', Buffer.byteLength(result)); return result.trim();
  };
  assert.equal(git('rev-parse', 'HEAD'), target); assert.equal(git('status', '--porcelain', '--untracked-files=no'), '');
  const reserved = await beforeDeadline(preparationDeadline, () => mkdir(output));
  assert.equal(reserved.state, 'settled', 'comparison_reservation_unknown'); // Never reuse/remove this reservation.
  let sourceRoot = ''; let sourceCreated = false; let inputsSettled = true; let outcomes: SideOutcome[] = []; let preparationPhase = 'evidence-size'; const errors: string[] = [];
  let diskSample: Promise<void> | undefined; let diskMonitor: ReturnType<typeof setInterval> | undefined;
  let cleanup: unknown = null; let finalEvidenceBytes = 0; let diskBytes: number | null = null;
  const deadline = started + COMPARISON.totalMs;
  const finalEvidence = async (name: string, value: unknown) => {
    const text = JSON.stringify(value, null, 2); finalEvidenceBytes += Buffer.byteLength(text);
    assert(finalEvidenceBytes <= COMPARISON.finalReserveBytes - 32768, 'comparison_final_evidence_reserve');
    assert(performance.now() < deadline - 250, 'comparison_final_write_deadline');
    await writeFile(join(output, name), text, { flag: 'wx', mode: 0o600 });
  };
  try {
    const preparation = await beforeDeadline(preparationDeadline, async () => {
      budget.chargeCommon('preparation', await directoryBytes(resolve(COMPARISON.preparation))); budget.work();
      preparationPhase = 'disk-gate'; diskBytes = await checkDisk(process.cwd()); budget.work();
      diskMonitor = setInterval(() => {
        if (diskSample) return;
        diskSample = checkDisk(process.cwd(), 0).then(() => {}, () => { budget.stop(); if (!errors.includes('comparison_disk_reserve_unavailable')) errors.push('comparison_disk_reserve_unavailable'); })
          .finally(() => { diskSample = undefined; });
      }, 1000);
      await finalEvidence('reservation.json', { windowId, target, startedAt: new Date().toISOString(), contract: COMPARISON, diskBytes,
        actualWindowAuthorization: 'requires separate named OPEN; this directory consumes that single attempt' }); budget.work();
      preparationPhase = 'fixed-source-export'; sourceRoot = join(tmpdir(), 'flow-s01-ab-input-' + randomUUID());
      await mkdir(sourceRoot, { mode: 0o700 }); sourceCreated = true; budget.work();
      const exported = await exportInputs(process.cwd(), sourceRoot, budget);
      preparationPhase = 'input-evidence'; await finalEvidence('inputs.json', exported); budget.work();
      preparationPhase = 'complete';
    });
    if (preparation.state !== 'settled') { inputsSettled = false; budget.stop(); throw new Error('comparison_input_unknown'); }
    outcomes = await compareSides(budget, async side => {
      const run = await beforeDeadline(budget.sideDeadlineMs, async () => {
        await checkDisk(process.cwd());
        return runMixed(windowId, target, 'event-state-' + side + '-v1', { sourceDirectory: join(sourceRoot, side), startedMs: budget.sideStartedMs, deadlineMs: budget.sideDeadlineMs, accounting: {
        charge: (category, bytes) => budget.chargeSide(category, bytes), work: () => budget.work(), submit: () => budget.submit(),
      } });
      });
      if (run.state !== 'settled') { budget.stop(); throw new Error('comparison_side_unknown'); }
      return run.value;
    });
  } catch (error) {
    errors.push(error instanceof Error && /^comparison_[a-z_]+$/.test(error.message) ? error.message : 'comparison_preparation_failed');
  } finally {
    clearInterval(diskMonitor);
    const diskSettled = await beforeDeadline(deadline - 1500, async () => { await diskSample; });
    if (diskSettled.state !== 'settled') errors.push('comparison_disk_measurement_unknown');
    const safe = sourceCreated && inputsSettled && outcomes.every(result => result.state === 'NOT_RUN' || result.receipt?.resourcesClosed === true);
    if (sourceRoot && safe) {
      const removed = await beforeDeadline(deadline - 1000, () => rm(sourceRoot, { recursive: true }));
      cleanup = { sourceRoot, removed: removed.state === 'settled', retained: removed.state !== 'settled' };
      if (removed.state !== 'settled') errors.push('comparison_input_cleanup_unknown');
    } else if (sourceRoot) { cleanup = { sourceRoot, removed: false, retained: true }; errors.push('comparison_input_retained'); }
  }
  if (!outcomes.length) outcomes = [{ side: 'A', state: 'NOT_RUN' }, { side: 'B', state: 'NOT_RUN' }];
  if (performance.now() >= deadline - 500) errors.push('comparison_deadline_exhausted');
  let success = outcomes.every(result => result.state === 'PASS') && errors.length === 0;
  const result = { windowId, target, outcomes, errors, cleanup, success, tasksSentOrUnknown: budget.tasks,
    finalMeasuredBytes: budget.usedBytes, categories: budget.categories, finalEvidenceBytes, finalReserveBytes: COMPARISON.finalReserveBytes,
    elapsedBeforeResultWriteMs: performance.now() - started, diskBytes, preparationPhase,
    byteBasis: 'visible Git/input export + Node streams + IPC + evidence with conservative duplicate charges; not all OS I/O or PG/WAL disk growth',
    order: 'A then B; shared host background and observer overhead remain confounders', providerCalls: 0 };
  const written = await beforeDeadline(deadline - 250, () => finalEvidence('result.json', result));
  if (written.state !== 'settled') { errors.push('comparison_final_evidence_unknown'); success = false; }
  if (performance.now() >= deadline) { errors.push('comparison_total_time_exhausted'); success = false; }
  return { ...result, success, errors, finalElapsedMs: performance.now() - started, finalEvidenceBytes };
}
