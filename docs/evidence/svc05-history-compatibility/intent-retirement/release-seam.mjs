/** Only this approved legacy intent can take this explicit pre-retirement observation path. */
import { join } from 'node:path';
import { lstat } from 'node:fs/promises';
import { observeHost } from '../release-operation/observe.mjs';
import { compare } from '../release-operation/preservation.mjs';
import { boundIntent, sha, source } from './retire.mjs';
import { exactHistory } from './host-fence.mjs';

export function requestFromReceipts(template, baseline, held, authorization) {
  const b = baseline.facts, row = b?.database?.runners?.find(value => value.id === template.runnerId);
  if (baseline.outcome !== 'observed' || !row || row.maintenance_version !== 15 || row.maintenance_state !== 'accepting'
    || b.files['config.json'].sha256 !== template.configSha256 || b.files['state.json'].sha256 !== template.stateSha256
    || b.native.admission?.originalSha256 !== template.originalSha256 || !b.native.admission.legacyUnresolved
    || held.outcome !== 'held-runner-stopped' || held.stopped !== 'stopped' || held.confirmed !== 'stopped'
    || held.hold?.state !== 'maintenance' || held.hold.version !== 17 || held.hold.runnerId !== template.runnerId
    || held.stateSha256 !== template.stateSha256) throw Error('RECEIPT_OR_FROZEN_BASELINE_MISMATCH');
  // Only operation identity returned by the reviewed hold and the new authorization are variable.
  return { ...template, operationId: held.hold.operationId, holdVersion: 17, authorization };
}

export async function observeLegacyIntent(request) {
  return observeHost((root, baseUrl) => sampleLegacyIntent(request, root, baseUrl));
}
/** Same private file sampler as the real observation; it needs no future maintenance identity. */
export async function sampleLegacyIntent(request, root, baseUrl) {
    if (root !== join(request.root, 'runner') || baseUrl !== request.baseUrl) throw Error('EXACT_NATIVE_ROOT');
    const bound = await boundIntent(request); await exactHistory(request);
    const st = await lstat(root);
    const files = [...request.history, { path: request.namespace + '/admission.json', bytes: bound.original.bytes.length, sha256: sha(bound.original.bytes) }]
      .sort((a, b) => a.path.localeCompare(b.path));
    return { dev: st.dev, ino: st.ino, uid: st.uid, files, totalBytes: files.reduce((n, file) => n + file.bytes, 0),
      admission: { idle: false, legacyUnresolved: true, originalSha256: sha(bound.original.bytes), newSha256: sha(bound.replacement), newBytes: bound.replacement.length },
      observations: 'Exact fixed schema/hash/identity and complete four-file history; not ordinary idle.', nonAtomic: true };
}

export function compareLegacyRelease(before, after, phase, proposal, request, retirement) {
  const base = compare(before, after, phase, proposal);
  if (before.outcome !== 'observed' || after.outcome !== 'observed') return base;
  const b = before.facts, a = after.facts, journal = request.namespace + '/admission.json';
  const retired = ['paused', 'resumed', 'published'].includes(phase);
  const legacy = b.native.admission;
  const binding = request.source === source && legacy?.legacyUnresolved === true && legacy.idle === false
    && legacy.originalSha256 === request.originalSha256;
  const nativePolicy = binding && (retired
    ? retirement?.outcome === 'retired' && retirement.renamed === true && retirement.originalSha256 === request.originalSha256
      && retirement.newSha256 === legacy.newSha256 && a.native.admission?.idle === true && a.operation.operationId === request.operationId
    : a.native.admission?.legacyUnresolved === true && a.native.admission.originalSha256 === request.originalSha256 && a.native.admission.idle === false);
  const expected = b.native.files.map(file => file.path === journal && retired
    ? { ...file, bytes: legacy.newBytes, sha256: legacy.newSha256 } : file);
  const { nativeIdle, nativeFiles, ...checks } = base.checks;
  checks.explicitLegacyIntentPolicy = nativePolicy;
  checks.nativeHistory = b.native.dev === a.native.dev && b.native.ino === a.native.ino && b.native.uid === a.native.uid
    && expected.length === request.history.length + 1 && JSON.stringify(expected) === JSON.stringify(a.native.files)
    && expected.reduce((n, file) => n + file.bytes, 0) === a.native.totalBytes;
  checks.waitingQueueEmpty = a.database.queue.every(row => row.state !== 'waiting' || row.count === 0);
  return { ...base, checks, ordinaryNativeChecks: { nativeIdle, nativeFiles }, passed: Object.values(checks).every(Boolean),
    exception: { kind: 'one-approved-legacy-intent', journal, oldSha256: request.originalSha256,
      newSha256: retired ? legacy.newSha256 : null, rawObservationsModified: false, privateAuditSeparate: true },
    limits: [...base.limits.filter(value => !value.startsWith('Filesystem/process') && !value.startsWith('Native sample')),
      'Before is explicitly non-idle; only the fixed retired journal bytes may differ. All history files remain exact.',
      'Private retirement directory lives outside runner root; its backup/intent/result and hashes require separate checkpoint binding.'] };
}
