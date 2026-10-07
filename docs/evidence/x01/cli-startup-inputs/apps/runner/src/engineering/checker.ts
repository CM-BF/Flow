import { chmod, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { EngineeringIntent, EngineeringReceipt } from '../../../../packages/contracts/src/engineering.js';
import { digest, readTextFile, runCommand } from './resources.js';
import { NativeExecutionError } from '../native-harness/settlement.js';
import { readDirectoryRecord, recordDirectory } from './identity.js';

export interface TrustedChecker {
  rootDirectory: string;
  selection: EngineeringIntent['checker'];
  run(directory: string, signal: AbortSignal): Promise<Pick<EngineeringReceipt, 'checker' | 'command'>>;
  dispose(): Promise<void>;
}
const checksSchema = z.strictObject({ checks: z.array(z.strictObject({ id: z.string().min(1).max(128), passed: z.boolean() })).max(32) });

/** Creates a host-owned baseline outside every workspace. Source/expected checks come from trusted setup, never task data. */
export async function createTrustedChecker(parent: string, id: string, source: string, expectedChecks: string[], timeoutMs = 2000): Promise<TrustedChecker> {
  if (expectedChecks.length < 1 || expectedChecks.length > 32 || new Set(expectedChecks).size !== expectedChecks.length || expectedChecks.some(check => !check || check.length > 128)) throw new Error('Invalid trusted checker cases.');
  if (Buffer.byteLength(source) > 65_536 || source.includes('\0')) throw new Error('Invalid trusted checker source.');
  const root = await realpath(await mkdtemp(join(parent, 'flow-checker-'))), file = join(root, 'baseline.mjs');
  await writeFile(file, source, { mode: 0o400 });
  const selection = { id, version: '1' as const, baselineDigest: digest(source) };
  await recordDirectory(root, '.flow-checker.json', { selection, expectedChecks, timeoutMs });
  return checkerHandle(root, selection, expectedChecks, timeoutMs);
}
const checkerRecord = z.strictObject({ selection: z.strictObject({ id: z.string().min(1).max(128), version: z.literal('1'), baselineDigest: z.string().regex(/^[a-f0-9]{64}$/) }), expectedChecks: z.array(z.string().min(1).max(128)).min(1).max(32), timeoutMs: z.number().int().min(1).max(30_000) });
export async function restoreTrustedChecker(root: string, expected: { selection: EngineeringIntent['checker']; expectedChecks: string[]; timeoutMs: number }): Promise<TrustedChecker> {
  const recorded = await readDirectoryRecord(root, '.flow-checker.json', checkerRecord);
  if (JSON.stringify(recorded) !== JSON.stringify(checkerRecord.parse(expected)) || digest((await readTextFile(join(root, 'baseline.mjs'), 65_536)).content) !== expected.selection.baselineDigest) throw new Error('Trusted checker identity changed.');
  return checkerHandle(root, recorded.selection, recorded.expectedChecks, recorded.timeoutMs);
}
function checkerHandle(root: string, selection: EngineeringIntent['checker'], expectedChecks: string[], timeoutMs: number): TrustedChecker {
  const { id, baselineDigest } = selection, file = join(root, 'baseline.mjs');
  selection = Object.freeze({ ...selection });
  const expected = [...expectedChecks], args = [file], commandDigest = digest(JSON.stringify({ executable: process.execPath, args: ['HOST_BASELINE', 'MANAGED_WORKSPACE'], baselineDigest, expected, timeoutMs }));
  let running = false, retained = false, disposed = false;
  return {
    rootDirectory: root, selection,
    async run(directory, signal) {
      if (running || retained || disposed) throw new Error('Trusted checker is unavailable.');
      running = true;
      try {
        const baselineBeforeDigest = digest((await readTextFile(file, 65_536)).content);
        if (baselineBeforeDigest !== baselineDigest) throw new Error('Trusted checker baseline changed before execution.');
        const command = await runCommand({ executable: process.execPath, args: [...args, directory], cwd: root, timeoutMs, signal });
        retained = !command.childExited;
        if (retained) throw new NativeExecutionError('unknown');
        const baselineAfterDigest = digest((await readTextFile(file, 65_536)).content);
        let checks: EngineeringReceipt['checker']['checks'] = [];
        try { checks = checksSchema.parse(JSON.parse(command.stdout)).checks; } catch { /* Incomplete or malformed output cannot pass. */ }
        return { command, checker: { id, version: '1', baselineBeforeDigest, baselineAfterDigest, commandDigest, expectedChecks: [...expected], checks } };
      } finally { running = false; }
    },
    async dispose() { if (running || retained) throw new Error('Cannot remove a checker with unresolved execution.'); disposed = true; await chmod(file, 0o600); await rm(root, { recursive: true }); },
  };
}
