import { VERIFIER_RUNNER_CLAIM_PROTOCOL, type VerifierRunnerClaimRequest } from '../../../packages/contracts/src/verifier-runner-claim.js';
import type { PoolClient } from 'pg';
import { RUNNER_CLAIM_PROTOCOL, runnerClaimReceiptSchema, type RunnerClaimReceipt, type RunnerClaimRequest } from '../../../packages/contracts/src/runner-claim.js';
import { PLUGIN_RUNNER_CLAIM_PROTOCOL, type PluginRunnerClaimRequest } from '../../../packages/contracts/src/plugin-runner-claim.js';
import { canonical, HttpError, sha256 } from './database.js';

function address(input: RunnerClaimRequest | PluginRunnerClaimRequest | VerifierRunnerClaimRequest) {
  return { operation: `${input.protocol}:${input.runnerId}`, key: input.requestId, digest: sha256(canonical(input)) };
}

/** Caller holds this authenticated runner's exclusive lock for the entire transaction. */
export async function readClaimReceipt(client: PoolClient, input: RunnerClaimRequest | PluginRunnerClaimRequest | VerifierRunnerClaimRequest): Promise<RunnerClaimReceipt | null> {
  const { operation, key, digest } = address(input);
  const rows = (await client.query<{ operation: string; digest: string; response: unknown }>(
    'SELECT operation,digest,response FROM flow.commands WHERE operation=ANY($1::text[]) AND key=$2',
    [[RUNNER_CLAIM_PROTOCOL, PLUGIN_RUNNER_CLAIM_PROTOCOL, VERIFIER_RUNNER_CLAIM_PROTOCOL].map(protocol => `${protocol}:${input.runnerId}`), key])).rows;
  if (rows.length > 1) throw new HttpError(409, 'claim_receipt_unknown', 'Multiple allocation receipts require reconciliation.');
  const saved = rows[0];
  if (!saved) return null;
  if (saved.operation !== operation || saved.digest !== digest) throw new HttpError(409, 'claim_key_conflict', 'The claim opportunity is bound to different input.');
  const parsed = runnerClaimReceiptSchema.safeParse(saved.response);
  if (!parsed.success || parsed.data.runnerId !== input.runnerId) throw new HttpError(409, 'claim_receipt_unknown', 'The allocation receipt cannot be verified.');
  return parsed.data;
}

/** Nonempty only: no permanent receipt for idle polls, private prompt, or stale lease grant. */
export async function saveClaimReceipt(client: PoolClient, input: RunnerClaimRequest | PluginRunnerClaimRequest | VerifierRunnerClaimRequest, identity: RunnerClaimReceipt): Promise<void> {
  const receipt = runnerClaimReceiptSchema.parse(identity);
  if (receipt.runnerId !== input.runnerId) throw new HttpError(409, 'claim_receipt_unknown', 'The allocation belongs to another runner.');
  const { operation, key, digest } = address(input);
  await client.query('INSERT INTO flow.commands(operation,key,digest,response) VALUES($1,$2,$3,$4)', [operation, key, digest, JSON.stringify(receipt)]);
}
