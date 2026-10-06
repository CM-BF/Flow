/** One legacy local intent resolution, never a claim receipt or an admission retry. */
import { constants } from 'node:fs';
import { lstat, mkdir, open, rename } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';

export const source = 'af51c621696230fbced12227670f014ca73bd8a1';
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const fail = code => { throw Object.assign(Error(code), { code }); };
const sameIdentity = (a, b) => a.dev === b.dev && a.ino === b.ino && a.uid === b.uid;
const sameFile = (a, b) => sameIdentity(a, b) && a.size === b.size && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;
export const identity = st => ({ dev: st.dev, ino: st.ino, uid: st.uid });

export async function readRegular(path, limit = 65536) {
  const file = await open(path, constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
  try {
    const before = await file.stat();
    if (!before.isFile() || before.uid !== process.getuid() || (before.mode & 0o777) !== 0o600 || before.size > limit) fail('PRIVATE_FILE');
    const bytes = Buffer.alloc(limit + 1); let offset = 0;
    while (offset < bytes.length) { const next = await file.read(bytes, offset, bytes.length - offset, null); if (!next.bytesRead) break; offset += next.bytesRead; }
    if (offset > limit || !sameFile(before, await file.stat()) || !sameFile(before, await lstat(path))) fail('FILE_CHANGED_OR_BOUND');
    return { bytes: bytes.subarray(0, offset), stat: before };
  } finally { await file.close(); }
}
async function syncDirectory(path) {
  const handle = await open(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try { await handle.sync(); } finally { await handle.close(); }
}
async function persist(path, bytes) {
  const handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
  await syncDirectory(dirname(path));
}
const encoded = value => Buffer.from(JSON.stringify(value) + '\n');

function locations(request) {
  if (request.source !== source || !uuid.test(request.retirementId) || !uuid.test(request.operationId)
    || !uuid.test(request.runnerId) || !Number.isSafeInteger(request.holdVersion) || request.holdVersion < 1
    || request.baseUrl !== 'http://127.0.0.1:61227' || !/^[a-f0-9]{64}$/.test(request.originalSha256)) fail('REQUEST');
  const namespace = sha(request.baseUrl.replace(/\/$/, ''));
  if (request.namespace !== namespace) fail('NAMESPACE');
  return { namespace: join(request.root, 'runner', namespace), journal: join(request.root, 'runner', namespace, 'admission.json'),
    archive: join(request.root, 'admission-retirement-' + request.retirementId) };
}
async function checkDirectories(request, paths) {
  for (const [path, expected] of [[request.root, request.rootIdentity], [join(request.root, 'runner'), request.runnerIdentity], [paths.namespace, request.namespaceIdentity]]) {
    const st = await lstat(path);
    if (!expected || !st.isDirectory() || st.isSymbolicLink() || st.uid !== process.getuid() || (st.mode & 0o777) !== 0o700 || !sameIdentity(st, expected)) fail('DIRECTORY_IDENTITY');
  }
}
function assertConfirmation(request, fact) {
  if (!fact || fact.source !== source || fact.sourceClean !== true || fact.runnerId !== request.runnerId
    || fact.operationId !== request.operationId || fact.version !== request.holdVersion || fact.state !== 'maintenance'
    || fact.runnerStopped !== true || fact.soleWriterConfirmed !== true || fact.inventoryComplete !== true
    || fact.globalUnfinished !== 0 || fact.globalUncertain !== 0 || fact.pendingTasks !== 0
    || fact.pendingOutbox !== 0 || fact.pendingFinal !== 0 || fact.pendingUnknown !== 0) fail('FENCE_UNCONFIRMED');
}
function fixedNewBytes(original) {
  const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(original));
  if (!value || Object.keys(value).sort().join(',') !== 'assignments,inFlight,version' || value.version !== 1
    || !uuid.test(value.inFlight ?? '') || !Array.isArray(value.assignments) || value.assignments.length !== 0) fail('LEGACY_INTENT_SHAPE');
  return Buffer.from(JSON.stringify({ ...value, inFlight: null }));
}

/** ports.withFence keeps the existing host operation lock and same runner row lock until use returns. */
export async function retireIntent(request, ports) {
  let phase = 'guard', paths, original, replacement, renamed = false;
  const result = () => ({ phase, originalSha256: request.originalSha256, newSha256: replacement ? sha(replacement) : null, renamed });
  try {
    paths = locations(request);
    return await ports.withFence(request, async confirm => {
      assertConfirmation(request, await confirm()); await checkDirectories(request, paths);
      original = await readRegular(paths.journal);
      if (!sameIdentity(original.stat, request.journalIdentity) || sha(original.bytes) !== request.originalSha256) fail('ORIGINAL_CHANGED');
      replacement = fixedNewBytes(original.bytes);
      // Exclusive directory makes every attempt one-shot, including interrupted attempts.
      phase = 'reservation'; await mkdir(paths.archive, { mode: 0o700 }); await syncDirectory(request.root);
      phase = 'backup'; await ports.boundary?.(phase);
      await persist(join(paths.archive, 'original.bin'), original.bytes);
      phase = 'intent'; await ports.boundary?.(phase);
      await persist(join(paths.archive, 'intent.json'), encoded({ kind: 'legacy-local-intent-retirement', retirementId: request.retirementId,
        runnerId: request.runnerId, operationId: request.operationId, holdVersion: request.holdVersion, source,
        namespace: request.namespace, originalSha256: request.originalSha256, newSha256: sha(replacement), originalIdentity: identity(original.stat),
        meaning: 'Operator retirement under a durable hold; original claim outcome remains unknown. No claim replay or fabricated ACK.' }));
      phase = 'stage'; await ports.boundary?.(phase);
      await persist(join(paths.archive, 'replacement.bin'), replacement);
      // Rename candidate is in the journal directory; its exact bytes are also retained in the archive.
      const stage = join(paths.namespace, 'admission-retirement-' + request.retirementId + '.tmp');
      phase = 'recheck'; await ports.boundary?.(phase);
      assertConfirmation(request, await confirm()); await checkDirectories(request, paths);
      const current = await readRegular(paths.journal);
      if (!sameFile(original.stat, current.stat) || sha(current.bytes) !== request.originalSha256) fail('ORIGINAL_CHANGED');
      await persist(stage, replacement);
      await checkDirectories(request, paths);
      if (!sameFile(original.stat, (await readRegular(paths.journal)).stat)) fail('ORIGINAL_CHANGED');
      if (sha((await readRegular(stage)).bytes) !== sha(replacement)) fail('STAGE_CHANGED');
      phase = 'rename'; await ports.boundary?.(phase);
      await rename(stage, paths.journal); renamed = true; await syncDirectory(paths.namespace);
      if (sha((await readRegular(paths.journal)).bytes) !== sha(replacement)) fail('RETIREMENT_CHANGED');
      phase = 'audit'; await ports.boundary?.(phase);
      await persist(join(paths.archive, 'result.json'), encoded({ ...result(), outcome: 'retired', at: new Date().toISOString() }));
      phase = 'complete'; return { ...result(), outcome: 'retired' };
    });
  } catch (error) {
    // Preserve every file; even a released fence or final audit failure must not trigger a second write.
    return { ...result(), outcome: phase === 'guard' ? 'not-retired' : 'unknown',
      code: /^[A-Z0-9_]+$/.test(error.code ?? '') ? error.code : 'RETIREMENT_UNKNOWN' };
  }
}

/** Read-only diagnosis after unknown; byte equality is not an ACK or permission to retry. */
export async function inspectRetirement(request) {
  try {
    const paths = locations(request); await checkDirectories(request, paths);
    const original = await readRegular(join(paths.archive, 'original.bin'));
    if (sha(original.bytes) !== request.originalSha256) fail('BACKUP_CHANGED');
    const replacement = fixedNewBytes(original.bytes), current = await readRegular(paths.journal);
    const digest = sha(current.bytes);
    return { outcome: 'observed', current: digest === request.originalSha256 ? 'original' : digest === sha(replacement) ? 'retired-bytes' : 'other',
      originalSha256: request.originalSha256, newSha256: sha(replacement), currentSha256: digest, writes: 0 };
  } catch { return { outcome: 'unknown', current: 'unreadable-or-unbound', writes: 0 }; }
}
