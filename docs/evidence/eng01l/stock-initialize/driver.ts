/** Evidence caller only: the default host owns R06; no thread, turn, catalogue or tool call. */
import { constants, closeSync, fsyncSync, lstatSync, openSync, readFileSync, realpathSync, writeFileSync, writeSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { CodexTransportError, type CodexTransport, type CloseReport } from '../../../../apps/runner/src/codex/types.js';
import { prepareTrustedToolHost, TrustedToolHostPreparationError, type TrustedToolHostStop } from '../../../../apps/runner/src/engineering/native-tool-host.js';

const scratch = process.argv[2], out = process.argv[3];
if (!scratch || !out || !scratch.startsWith('/private/tmp/eng01l-initialize-')
  || realpathSync(scratch) !== scratch || realpathSync(out) !== out
  || out !== new URL('./run-once', import.meta.url).pathname) throw Error('OWN_PATH_REQUIRED');
const outputDirectory = out;
function pin(path: string) {
  const s = lstatSync(path, { bigint: true });
  if (s.uid !== BigInt(process.getuid!()) || (s.mode & 0o077n) !== 0n || s.isSymbolicLink()) throw Error('PRIVATE_OWNER_REQUIRED');
  return { dev: s.dev.toString(), ino: s.ino.toString() };
}
const directory = join(scratch, 'workspace'), runtimeDirectory = join(scratch, 'runtime');
const owned = [scratch, out, directory, runtimeDirectory, join(runtimeDirectory, 'control'), join(runtimeDirectory, 'state'),
  join(directory, 'calculator.mjs'), join(directory, 'baseline.txt')].map(path => ({ path, identity: pin(path) }));
function assertOwned() { for (const p of owned) if (JSON.stringify(pin(p.path)) !== JSON.stringify(p.identity)) throw Error('OWN_IDENTITY_CHANGED'); }
function save(name: string, value: unknown) {
  assertOwned();
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n');
  if (bytes.length > 4096) throw Error('DRIVER_RECORD_LIMIT');
  const fd = openSync(join(outputDirectory, name), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
  const parent = openSync(outputDirectory, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { fsyncSync(parent); } finally { closeSync(parent); }
}
const abort = new AbortController();
process.once('SIGTERM', () => abort.abort());
process.once('SIGINT', () => abort.abort());
const stderrFd = openSync(join(out, 'native.stderr'), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
let written = 0, stage = 'prepare', ready = false, attempted = false;
let primaryFailure: { stage: string; code: string } | null = null;
let host: Awaited<ReturnType<typeof prepareTrustedToolHost>> | undefined, transport: CodexTransport | undefined;
let cleanup: TrustedToolHostStop = { child: 'unconfirmed', hostWrite: 'unknown', nativeWriteAccess: 'unknown' };
let cleanupFailure: { code: string } | null = null, transportClose: CloseReport | undefined;
let failedPreparation: TrustedToolHostPreparationError | undefined;
const binding = Object.freeze({ identity: Object.freeze({ taskId: 'eng01l-isolated', attemptId: 'initialize-once', runnerId: 'owned-fixture', ownerVersion: 1 }),
  leaseId: '8f9f9b06-2c72-4928-919b-22ae72dcf243', baseCommit: 'd556780129897582f09945c0621aa2ed64fb52f7', generation: 1 });
try {
  save('driver-intent.json', { scope: 'initialize/initialized only', binding, ownership: 'private fixture identity, not a production lease/grant', providerCalls: 0 });
  host = await prepareTrustedToolHost({ directory, runtimeDirectory,
    startupRecipe: readFileSync(new URL('../../eng01j/helper-host/startup-input.sb', import.meta.url), 'utf8'),
    binding, model: 'gpt-6-astra', prompt: 'Not submitted. Initialize only.', signal: abort.signal,
    async assertOwnership(actual) { assertOwned(); if (JSON.stringify(actual) !== JSON.stringify(binding)) throw Error('BINDING_CHANGED'); },
    privateStderr: { maxBytes: 8192, write(chunk) {
      if (written + chunk.length > 8192) throw Error('STDERR_LIMIT');
      let offset = 0;
      while (offset < chunk.length) { const count = writeSync(stderrFd, chunk, offset, chunk.length - offset); if (!count) throw Error('STDERR_WRITE_FAILED'); offset += count; }
      written += chunk.length;
    } },
  });
  stage = 'launch'; attempted = true;
  transport = host.createTransport({ workingDirectory: directory, signal: abort.signal });
  stage = 'initialize';
  const info = await transport.ready; ready = true;
  save('initialized.json', { ready, userAgentSha256: createHash('sha256').update(info.userAgent).digest('hex'),
    platformFamily: info.platformFamily, platformOs: info.platformOs, policySha256: host.policySha256, snapshot: transport.snapshot() });
} catch (error) {
  primaryFailure = { stage, code: error instanceof CodexTransportError ? error.code : 'DRIVER_STAGE_FAILED' };
  if (error instanceof TrustedToolHostPreparationError) failedPreparation = error;
} finally {
  try {
    if (host || failedPreparation) cleanup = await (host ?? failedPreparation)!.close(AbortSignal.timeout(1000));
    if (transport && cleanup.child === 'confirmed-exited') transportClose = await transport.closed;
  } catch { cleanupFailure = { code: 'HOST_CLOSE_FAILED' }; }
  try { fsyncSync(stderrFd); } catch { cleanupFailure ??= { code: 'STDERR_SYNC_FAILED' }; }
  closeSync(stderrFd);
}
const capture = transportClose?.stderrCapture;
const diagnosticComplete = capture !== undefined && !capture.truncated && !capture.observerFailed && !capture.incomplete
  && capture.streamEnded && capture.childCloseObserved && capture.writtenBytes === written;
save('driver-result.json', { ready, attempted, primaryFailure, cleanupFailure, cleanup, transportClose, diagnosticComplete,
  stderrBytes: written, targetIdentity: host?.targetIdentity, policySha256: host?.policySha256,
  threadRequests: 0, turnRequests: 0, catalogueRequests: 0, hostToolCalls: 0, providerCalls: 0, nativeWriteAccess: 'unknown' });
process.exitCode = ready && !primaryFailure && !cleanupFailure && diagnosticComplete
  && cleanup.child === 'confirmed-exited' && cleanup.hostWrite === 'settled' ? 0 : 1;
