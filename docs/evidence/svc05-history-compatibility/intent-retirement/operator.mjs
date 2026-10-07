/** Explicit one-shot entry; the caller must use the reviewed external supervisor. */
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { retireIntent, readRegular, sha } from './retire.mjs';
import { withHostFence } from './host-fence.mjs';
import { durable } from '../center-recovery/facts.mjs';

export async function runRetirement(request) {
  return retireIntent(request, { withFence: withHostFence });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [mode, requestPath, digest, outputDirectory] = process.argv.slice(2);
  if (mode !== '--retire-once' || !requestPath || !/^[a-f0-9]{64}$/.test(digest ?? '') || !outputDirectory) throw Error('EXPLICIT_BOUND_INPUT_REQUIRED');
  const bytes = (await readRegular(requestPath)).bytes;
  if (sha(bytes) !== digest) throw Error('REQUEST_CHANGED');
  const request = JSON.parse(bytes);
  const permit = request.authorization;
  if (permit?.kind !== 'svc05h-legacy-intent-once' || permit.approvedBy !== 'Goal Owner'
    || typeof permit.reference !== 'string' || !permit.reference.trim() || !permit.approvalId
    || !Number.isFinite(Date.parse(permit.approvedAt)) || !Number.isFinite(Date.parse(permit.expiresAt))
    || Date.now() < Date.parse(permit.approvedAt) || Date.now() >= Date.parse(permit.expiresAt)) throw Error('AUTHORIZATION_REQUIRED');
  // Exclusive evidence reservation precedes every authority/read/write action in the operator.
  await durable(join(outputDirectory, 'reservation.json'), { requestSha256: digest, approvalId: permit.approvalId, at: new Date().toISOString() });
  const result = await runRetirement(request);
  await durable(join(outputDirectory, 'result.json'), result);
  console.log(JSON.stringify(result));
  if (result.outcome !== 'retired') process.exitCode = 1;
}
