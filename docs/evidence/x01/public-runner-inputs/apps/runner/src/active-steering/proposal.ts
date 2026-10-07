import { readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { MAX_BATCH_BYTES } from '@flow/contracts';
import { steeringFinalizationSchema } from '../../../../packages/contracts/src/runner.js';
import type { SteeringFinalizationInput, SteeringFinalizationResult, SteeringProposalLookup, SteeringProposalStatus } from '../../../../packages/contracts/src/active-steering.js';

export interface FinalizationTransport {
  submit(input: SteeringFinalizationInput): Promise<SteeringFinalizationResult>;
  status(input: SteeringProposalLookup): Promise<SteeringProposalStatus>;
}
export class FinalizationUnknown extends Error {
  constructor() { super('Final proposal outcome is unknown; its original bytes are retained and native input is paused.'); }
}
export class FinalProposalJournal {
  private readonly file: string;
  constructor(directory: string) { this.file = join(directory, 'pending-final-proposal.json'); }
  async commit(input: SteeringFinalizationInput, transport: FinalizationTransport): Promise<SteeringFinalizationResult> {
    // Never replace an unresolved prior proposal, even if the process reconstructed this journal.
    try { await stat(this.file); throw new FinalizationUnknown(); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    await writeFile(`${this.file}.tmp`, JSON.stringify(input), { mode: 0o600, flag: 'w' });
    await rename(`${this.file}.tmp`, this.file);
    let result: SteeringFinalizationResult;
    try { result = await transport.submit(input); }
    catch {
      try {
        const receipt = await transport.status(lookup(input));
        if (receipt.state !== 'committed') throw new FinalizationUnknown();
        result = receipt;
      } catch { throw new FinalizationUnknown(); }
    }
    if (result.proposalId !== input.proposalId || !Number.isSafeInteger(result.lastSequence)
      || result.lastSequence !== (result.state === 'committed' ? input.afterSequence + input.events.length : input.afterSequence)) throw new FinalizationUnknown();
    await unlink(this.file);
    return result;
  }
  async recover(status: FinalizationTransport['status']): Promise<'missing' | { attemptId: string }> {
    let input: SteeringFinalizationInput;
    try {
      if ((await stat(this.file)).size > MAX_BATCH_BYTES) throw new FinalizationUnknown();
      input = steeringFinalizationSchema.parse(JSON.parse(await readFile(this.file, 'utf8')));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 'missing';
      throw new FinalizationUnknown();
    }
    let receipt: SteeringProposalStatus;
    try { receipt = await status(lookup(input)); } catch { throw new FinalizationUnknown(); }
    if (receipt.state !== 'committed' || receipt.proposalId !== input.proposalId || receipt.lastSequence !== input.afterSequence + input.events.length) throw new FinalizationUnknown();
    // A receipt proves the final, not SDK shutdown or runtime completion. Never synthesize completed.
    await rename(this.file, join(dirname(this.file), 'confirmed-final-proposal.json'));
    return { attemptId: input.attemptId };
  }
}

function lookup(input: SteeringFinalizationInput): SteeringProposalLookup {
  return { attemptId: input.attemptId, ownerVersion: input.ownerVersion, proposalId: input.proposalId };
}
