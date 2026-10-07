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

function journalLocations(request) {
  if (request.source !== source || !uuid.test(request.retirementId)
    || !uuid.test(request.runnerId)
    || request.baseUrl !== 'http://127.0.0.1:61227' || !/^[a-f0-9]{64}$/.test(request.originalSha256)) fail('REQUEST');
  const namespace = sha(request.baseUrl.replace(/\/$/, ''));
  if (request.namespace !== namespace) fail('NAMESPACE');
  return { namespace: join(request.root, 'runner', namespace), journal: join(request.root, 'runner', namespace, 'admission.json'),
    archive: join(request.root, 'admission-retirement-' + request.retirementId) };
}
function mutationLocations(request) {
  if (!uuid.test(request.operationId) || !Number.isSafeInteger(request.holdVersion) || request.holdVersion < 1) fail('MAINTENANCE_REQUEST');
  return journalLocations(request);
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
    || fact.globalUnfinished !== 0 || fact.globalUncertain !== 0
    || fact.pendingOutbox !== 0 || fact.pendingFinal !== 0 || fact.pendingUnknown !== 0) fail('FENCE_UNCONFIRMED');
  if (request.confirmation === undefined) {
    if (fact.pendingTasks !== 0 || fact.pendingQueue !== 0) fail('FENCE_UNCONFIRMED');
  } else {
    assertPreservedQueueEvidence(request.confirmation, fact.centerEvidence);
    if (fact.pendingTasks !== request.confirmation.queuedTasks.length || fact.pendingQueue !== 0) fail('FENCE_UNCONFIRMED');
  }
}

export const preservedQueueProtocol = 'flow.intent-preserved-queued.v2';
const historyTables = ['attempts', 'tasks', 'conversation_queue'];
const requiredColumns = {
  attempts: ['id', 'task_id', 'runner_id', 'owner_version', 'completed_at'],
  tasks: ['id', 'status', 'current_attempt_id'],
  conversation_queue: ['id', 'state'],
};
const md5 = bytes => createHash('md5').update(bytes).digest('hex');
/** Explicit opt-in; never reinterpret a nonzero count as the original empty-pending policy. */
export function assertPreservedQueueContract(contract) {
  if (!contract || contract.protocol !== preservedQueueProtocol || !/^[a-f0-9]{64}$/.test(contract.baselineSha256)
    || !Array.isArray(contract.tables) || contract.tables.length !== historyTables.length
    || !Array.isArray(contract.queuedTasks) || contract.queuedTasks.length < 1 || contract.queuedTasks.length > 10000) fail('PRESERVED_QUEUE_CONTRACT');
  for (const [index, table] of contract.tables.entries()) {
    if (table.name !== historyTables[index] || !Array.isArray(table.columns) || table.columns.length > 100
      || new Set(table.columns).size !== table.columns.length || table.columns.some(column => !/^[a-z_][a-z0-9_]*$/.test(column))
      || requiredColumns[table.name].some(column => !table.columns.includes(column))
      || !Number.isSafeInteger(table.count) || table.count < 0 || table.count > 10000 || !/^[a-f0-9]{32}$/.test(table.digest)) fail('PRESERVED_QUEUE_CONTRACT');
  }
  const ids = contract.queuedTasks.map(task => task.id);
  if (new Set(ids).size !== ids.length || ids.some((id, index) => !uuid.test(id) || (index && id <= ids[index - 1]))
    || contract.queuedTasks.some(task => Object.keys(task).sort().join(',') !== 'current_attempt_id,id,status'
      || task.status !== 'queued' || task.current_attempt_id !== null)) fail('PRESERVED_QUEUE_CONTRACT');
}
/** All historical rows, including completed attempts, are bound to the pre-drain projection. */
export function assertPreservedQueueEvidence(contract, evidence) {
  assertPreservedQueueContract(contract);
  if (!evidence || evidence.protocol !== contract.protocol || evidence.baselineSha256 !== contract.baselineSha256
    || JSON.stringify(evidence.queuedTasks) !== JSON.stringify(contract.queuedTasks)
    || !Array.isArray(evidence.tables) || evidence.tables.length !== contract.tables.length) fail('PRESERVED_QUEUE_CHANGED');
  for (const [index, expected] of contract.tables.entries()) {
    const actual = evidence.tables[index];
    if (!actual || actual.name !== expected.name || JSON.stringify(actual.columns) !== JSON.stringify(expected.columns)
      || !Array.isArray(actual.rowHashes) || actual.rowHashes.length !== expected.count
      || actual.rowHashes.some(hash => !/^[a-f0-9]{32}$/.test(hash))
      || md5([...actual.rowHashes].sort().join('')) !== expected.digest) fail('PRESERVED_QUEUE_CHANGED');
  }
}
function fixedNewBytes(original) {
  const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(original));
  if (!value || Object.keys(value).sort().join(',') !== 'assignments,inFlight,version' || value.version !== 1
    || !uuid.test(value.inFlight ?? '') || !Array.isArray(value.assignments) || value.assignments.length !== 0) fail('LEGACY_INTENT_SHAPE');
  return Buffer.from(JSON.stringify({ ...value, inFlight: null }));
}
export async function boundIntent(request) {
  const paths = journalLocations(request); await checkDirectories(request, paths);
  const original = await readRegular(paths.journal);
  if (!sameIdentity(original.stat, request.journalIdentity) || sha(original.bytes) !== request.originalSha256) fail('ORIGINAL_CHANGED');
  return { paths, original, replacement: fixedNewBytes(original.bytes) };
}

/** ports.withFence keeps the existing host operation lock and same runner row lock until use returns. */
export async function retireIntent(request, ports) {
  let phase = 'guard', paths, original, replacement, renamed = false;
  const confirmations = [];
  const result = () => ({ phase, originalSha256: request.originalSha256, newSha256: replacement ? sha(replacement) : null, renamed,
    confirmationSha256: confirmations.map(fact => sha(encoded(fact))) });
  try {
    paths = mutationLocations(request);
    return await ports.withFence(request, async confirm => {
      const initial = await confirm(); assertConfirmation(request, initial); confirmations.push(initial); await checkDirectories(request, paths);
      ({ original, replacement } = await boundIntent(request));
      // Exclusive directory makes every attempt one-shot, including interrupted attempts.
      phase = 'reservation'; await mkdir(paths.archive, { mode: 0o700 }); await syncDirectory(request.root);
      phase = 'backup'; await ports.boundary?.(phase);
      await persist(join(paths.archive, 'original.bin'), original.bytes);
      phase = 'intent'; await ports.boundary?.(phase);
      await persist(join(paths.archive, 'intent.json'), encoded({ kind: 'legacy-local-intent-retirement', retirementId: request.retirementId,
        runnerId: request.runnerId, operationId: request.operationId, holdVersion: request.holdVersion, source,
        namespace: request.namespace, originalSha256: request.originalSha256, newSha256: sha(replacement), originalIdentity: identity(original.stat), initialConfirmation: initial,
        meaning: 'Operator retirement under a durable hold; original claim outcome remains unknown. No claim replay or fabricated ACK.' }));
      phase = 'stage'; await ports.boundary?.(phase);
      await persist(join(paths.archive, 'replacement.bin'), replacement);
      // Rename candidate is in the journal directory; its exact bytes are also retained in the archive.
      const stage = join(paths.namespace, 'admission-retirement-' + request.retirementId + '.tmp');
      phase = 'recheck'; await ports.boundary?.(phase);
      const final = await confirm(); assertConfirmation(request, final); confirmations.push(final); await checkDirectories(request, paths);
      await persist(join(paths.archive, 'pre-rename-confirmation.json'), encoded(final));
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
    const paths = mutationLocations(request); await checkDirectories(request, paths);
    const original = await readRegular(join(paths.archive, 'original.bin'));
    if (sha(original.bytes) !== request.originalSha256) fail('BACKUP_CHANGED');
    const replacement = fixedNewBytes(original.bytes), current = await readRegular(paths.journal);
    const digest = sha(current.bytes);
    return { outcome: 'observed', current: digest === request.originalSha256 ? 'original' : digest === sha(replacement) ? 'retired-bytes' : 'other',
      originalSha256: request.originalSha256, newSha256: sha(replacement), currentSha256: digest, writes: 0 };
  } catch { return { outcome: 'unknown', current: 'unreadable-or-unbound', writes: 0 }; }
}
