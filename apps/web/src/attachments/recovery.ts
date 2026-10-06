import {
  attachmentNameSchema, attachmentUploadKeySchema, attachmentReceiptSchema,
  attachmentReceiptLookupSchema, attachmentMetadataSchema, type AttachmentMetadata,
  type AttachmentReceipt, type AttachmentReceiptLookup, type AttachmentUpload,
} from '../../../../packages/contracts/src/attachments';
import { idSchema } from '@flow/contracts';

export const RECOVERY_LIMITS = Object.freeze({ records: 16, bytes: 65536 });
export interface RecoveryStorage { read(): string | null; write(value: string): void }
export interface RecoveryIdentity {
  readonly key: string; readonly scope: string; readonly projectId: string;
  readonly name: string; readonly mediaType: 'text/plain'; readonly byteLength: number; readonly contentDigest: string;
}
export interface RecoveryRecord extends RecoveryIdentity {
  readonly state: 'unknown' | 'ready' | 'expired' | 'unavailable';
  readonly resource?: Readonly<AttachmentMetadata>;
}
export interface RecoveryJournal {
  list(): readonly RecoveryRecord[];
  begin(identity: RecoveryIdentity): RecoveryRecord;
  accepted(identity: RecoveryIdentity, receipt: AttachmentReceipt): RecoveryRecord;
  observed(identity: RecoveryIdentity, lookup: AttachmentReceiptLookup): RecoveryRecord;
  forget(key: string): void;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const bytes = (text: string) => new TextEncoder().encode(text).length;
export function freezeMetadata(value: AttachmentMetadata): Readonly<AttachmentMetadata> {
  const parsed = attachmentMetadataSchema.parse(value);
  return Object.freeze({ ...parsed, reference: Object.freeze(parsed.reference) });
}
function identity(value: RecoveryIdentity): RecoveryIdentity {
  if (!value || !uuid.test(value.scope) || value.mediaType !== 'text/plain' || !Number.isInteger(value.byteLength)
    || value.byteLength < 1 || value.byteLength > 8192 || !/^[a-f0-9]{64}$/.test(value.contentDigest)) throw Error('Invalid upload recovery identity.');
  return Object.freeze({ key: attachmentUploadKeySchema.parse(value.key), scope: value.scope, projectId: idSchema.parse(value.projectId),
    name: attachmentNameSchema.parse(value.name), mediaType: value.mediaType, byteLength: value.byteLength, contentDigest: value.contentDigest });
}
export const recoveryIdentityKey = (value: RecoveryIdentity) => JSON.stringify([value.key, value.scope, value.projectId, value.name, value.mediaType, value.byteLength, value.contentDigest]);
export function recoveryUploadMatches(record: RecoveryIdentity, upload: AttachmentUpload) {
  return record.scope === upload.recoveryScopeId && record.name === upload.name && record.mediaType === upload.mediaType
    && record.byteLength === upload.byteLength && record.contentDigest === upload.contentDigest;
}
export function checkReceipt(expected: RecoveryIdentity, value: AttachmentReceipt): AttachmentReceipt {
  const { uploadKey, recoveryScopeId, requestDigest, resource: inputResource } = value;
  const result = attachmentReceiptSchema.parse({ uploadKey, recoveryScopeId, requestDigest, resource: inputResource }), resource = result.resource;
  if (result.uploadKey !== expected.key || result.recoveryScopeId !== expected.scope || resource.reference.projectId !== expected.projectId
    || resource.reference.contentDigest !== expected.contentDigest || resource.name !== expected.name
    || resource.mediaType !== expected.mediaType || resource.byteLength !== expected.byteLength) throw Error('Upload acknowledgement does not match the original request.');
  return result;
}
/** A host supplies one serialized journal owner per storage namespace. No text or credential is persisted. */
export function createRecoveryJournal(storage: RecoveryStorage): RecoveryJournal {
  function read(): readonly RecoveryRecord[] {
    const raw = storage.read(); if (raw === null) return Object.freeze([]);
    if (bytes(raw) > RECOVERY_LIMITS.bytes) throw Error('Upload recovery storage exceeds its byte limit.');
    const document = JSON.parse(raw) as { version?: unknown; records?: unknown };
    if (document?.version !== 1 || !Array.isArray(document.records) || document.records.length > RECOVERY_LIMITS.records) throw Error('Upload recovery storage is invalid; it was not erased.');
    const records = document.records.map((value: RecoveryRecord) => {
      const parsed = identity(value);
      if (!['unknown', 'ready', 'expired', 'unavailable'].includes(value.state)) throw Error('Invalid recovery state.');
      const resource = value.resource ? freezeMetadata(value.resource) : undefined;
      if (resource && (resource.reference.projectId !== parsed.projectId || resource.reference.contentDigest !== parsed.contentDigest
        || resource.name !== parsed.name || resource.byteLength !== parsed.byteLength || resource.mediaType !== parsed.mediaType)) throw Error('Invalid recovery resource.');
      if (value.state !== 'unknown' && !resource) throw Error('Recovery receipt is missing.');
      return Object.freeze({ ...parsed, state: value.state, ...(resource ? { resource } : {}) });
    });
    if (new Set(records.map(record => record.key)).size !== records.length) throw Error('Duplicate recovery keys.');
    return Object.freeze(records);
  }
  function save(record: RecoveryRecord) {
    const records = read(), old = records.find(item => item.key === record.key);
    if (old && recoveryIdentityKey(old) !== recoveryIdentityKey(record)) throw Error('An upload key already belongs to another request.');
    const next = old ? records.map(item => item.key === record.key ? record : item) : [...records, record];
    if (next.length > RECOVERY_LIMITS.records) throw Error('Recovery storage is full. Resolve or explicitly forget a known upload before adding another.');
    const raw = JSON.stringify({ version: 1, records: next });
    if (bytes(raw) > RECOVERY_LIMITS.bytes) throw Error('Recovery storage is full. Upload was not started.');
    storage.write(raw); return record;
  }
  return {
    list: read,
    begin(value) {
      const parsed = identity(value), old = read().find(item => item.key === parsed.key);
      if (old && recoveryIdentityKey(old) !== recoveryIdentityKey(parsed)) throw Error('Upload retry must preserve the original request.');
      return old ?? save(Object.freeze({ ...parsed, state: 'unknown' }));
    },
    accepted(value, receipt) {
      const parsed = identity(value), accepted = checkReceipt(parsed, receipt);
      return save(Object.freeze({ ...parsed, state: 'ready', resource: freezeMetadata(accepted.resource) }));
    },
    observed(value, lookup) {
      const parsed = identity(value), observed = attachmentReceiptLookupSchema.parse(lookup);
      checkReceipt(parsed, observed.receipt);
      return save(Object.freeze({ ...parsed, state: observed.current.state, resource: freezeMetadata({ ...observed.receipt.resource,
        state: observed.current.state === 'expired' ? 'expired' : 'ready', retained: observed.current.retained ?? false }) }));
    },
    forget(key) {
      const records = read(), record = records.find(item => item.key === key);
      if (record?.state === 'unknown') throw Error('An unknown upload cannot be silently discarded. Keep its original key for recovery.');
      storage.write(JSON.stringify({ version: 1, records: records.filter(item => item.key !== key) }));
    },
  };
}
