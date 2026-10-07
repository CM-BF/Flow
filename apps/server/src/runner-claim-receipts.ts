import type { PoolClient } from 'pg';
import { runnerClaimReceiptSchema, type RunnerClaimReceipt, type RunnerClaimRequest } from '@flow/contracts';
import { canonical, HttpError, sha256 } from './database.js';

function address(input: RunnerClaimRequest) {
  return { operation: `${input.protocol}:${input.runnerId}`, key: input.requestId, digest: sha256(canonical(input)) };
}

/** Caller holds this authenticated runner's exclusive lock for the entire transaction. */
export async function readClaimReceipt(client: PoolClient, input: RunnerClaimRequest): Promise<RunnerClaimReceipt | null> {
  const { operation, key, digest } = address(input);
  const saved = (await client.query<{ digest: string; response: unknown }>(
    'SELECT digest,response FROM flow.commands WHERE operation=$1 AND key=$2', [operation, key])).rows[0];
  if (!saved) return null;
  if (saved.digest !== digest) throw new HttpError(409, 'claim_key_conflict', 'The claim opportunity is bound to different input.');
  const parsed = runnerClaimReceiptSchema.safeParse(saved.response);
  if (!parsed.success || parsed.data.runnerId !== input.runnerId) throw new HttpError(409, 'claim_receipt_unknown', 'The allocation receipt cannot be verified.');
  return parsed.data;
}

/** Nonempty only: no permanent receipt for idle polls, private prompt, or stale lease grant. */
export async function saveClaimReceipt(client: PoolClient, input: RunnerClaimRequest, identity: RunnerClaimReceipt): Promise<void> {
  const receipt = runnerClaimReceiptSchema.parse(identity);
  if (receipt.runnerId !== input.runnerId) throw new HttpError(409, 'claim_receipt_unknown', 'The allocation belongs to another runner.');
  const { operation, key, digest } = address(input);
  await client.query('INSERT INTO flow.commands(operation,key,digest,response) VALUES($1,$2,$3,$4)', [operation, key, digest, JSON.stringify(receipt)]);
}
