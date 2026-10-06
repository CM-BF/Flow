import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { EngineeringIntent, EngineeringReceipt } from '../../../../packages/contracts/src/engineering.js';
import { digest, readTextFile, runCommand } from './resources.js';
import { NativeExecutionError } from '../native-harness/settlement.js';

export interface TrustedChecker {
  selection: EngineeringIntent['checker'];
  run(directory: string, signal: AbortSignal): Promise<Pick<EngineeringReceipt, 'checker' | 'command'>>;
  dispose(): Promise<void>;
}
const checksSchema = z.strictObject({ checks: z.array(z.strictObject({ id: z.string().min(1).max(128), passed: z.boolean() })).max(32) });

/** Creates a host-owned baseline outside every workspace. Source/expected checks come from trusted setup, never task data. */
export async function createTrustedChecker(parent: string, id: string, source: string, expectedChecks: string[], timeoutMs = 2000): Promise<TrustedChecker> {
  if (expectedChecks.length < 1 || expectedChecks.length > 32 || new Set(expectedChecks).size !== expectedChecks.length || expectedChecks.some(check => !check || check.length > 128)) throw new Error('Invalid trusted checker cases.');
  if (Buffer.byteLength(source) > 65_536 || source.includes('\0')) throw new Error('Invalid trusted checker source.');
  const root = await mkdtemp(join(parent, 'flow-checker-')), file = join(root, 'baseline.mjs');
  await writeFile(file, source, { mode: 0o400 });
  const baselineDigest = digest(source), selection = Object.freeze({ id, version: '1' as const, baselineDigest });
  const expected = [...expectedChecks], args = [file], commandDigest = digest(JSON.stringify({ executable: process.execPath, args: ['HOST_BASELINE', 'MANAGED_WORKSPACE'], baselineDigest, expected, timeoutMs }));
  let running = false, retained = false, disposed = false;
  return {
    selection,
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
