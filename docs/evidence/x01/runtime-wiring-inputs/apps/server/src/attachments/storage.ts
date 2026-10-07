import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import {
  ATTACHMENT_LIMITS as limits, attachmentUploadSchema, attachmentUploadKeySchema, attachmentSelectionSchema,
  type AttachmentAccepted, type AttachmentCapabilities, type AttachmentContent, type AttachmentDescriptor,
  type AttachmentList, type AttachmentMetadata, type AttachmentReceipt, type AttachmentReceiptLookup,
  type AttachmentReference, type AttachmentUpload,
} from '../../../../packages/contracts/src/attachments.js';
import { canonical, HttpError, sha256, transaction } from '../database.js';
import { loadProject } from '../projects/storage.js';
import { commandInTransaction } from '../tasks.js';

interface ResourceRow {
  id: string; project_id: string; version: 1; name: string; media_type: 'text/plain';
  content_digest: string; byte_length: number; created_at: Date; expires_at: Date;
  expired: boolean; retained: boolean; content?: string;
}
export type FrozenAttachment = AttachmentDescriptor & { text: string };
const metadataColumns = `r.id,r.project_id,r.version,r.name,r.media_type,r.content_digest,r.byte_length,r.created_at,r.expires_at,
  r.expires_at<=clock_timestamp() AS expired,EXISTS(SELECT 1 FROM flow.conversation_attachment_bindings b WHERE b.resource_id=r.id) AS retained`;
const missing = () => new HttpError(404, 'attachment_not_found', 'The resource does not belong to this project.');
const mismatch = () => new HttpError(409, 'attachment_reference_mismatch', 'The immutable attachment identity does not match.');
export async function attachmentsReady(client: PoolClient): Promise<boolean> {
  return Boolean((await client.query('SELECT 1 FROM flow.migrations WHERE version=26')).rowCount);
}
async function namespace(client: PoolClient): Promise<string> {
  if (!await attachmentsReady(client)) throw new HttpError(409, 'attachment_unavailable', 'Attachment resources are not installed.');
  const row = (await client.query<{ recovery_scope_id: string }>('SELECT recovery_scope_id FROM flow.attachment_namespace WHERE singleton')).rows[0];
  if (!row) throw new HttpError(409, 'attachment_unavailable', 'The attachment namespace is unavailable.');
  return row.recovery_scope_id;
}
function descriptor(row: ResourceRow): AttachmentDescriptor {
  return { reference: { kind: 'upload', projectId: row.project_id, resourceId: row.id, version: row.version, contentDigest: row.content_digest }, name: row.name, mediaType: row.media_type, byteLength: row.byte_length };
}
function metadata(row: ResourceRow): AttachmentMetadata {
  return { ...descriptor(row), createdAt: row.created_at.toISOString(), expiresAt: row.expires_at.toISOString(), state: row.expired ? 'expired' : 'ready', retained: row.retained };
}
async function resource(client: PoolClient, projectId: string, id: string, content = false): Promise<ResourceRow> {
  const row = (await client.query<ResourceRow>(`SELECT ${metadataColumns}${content ? ',r.content' : ''} FROM flow.attachment_resources r WHERE r.project_id=$1 AND r.id=$2`, [projectId, id])).rows[0];
  if (!row) throw missing();
  return row;
}
function exactText(row: ResourceRow): string {
  if (typeof row.content !== 'string' || Buffer.byteLength(row.content) !== row.byte_length || sha256(row.content) !== row.content_digest) throw mismatch();
  return row.content;
}
/** Caller holds project lock; pin uses the same project→resource order. FK preserves retained material. */
async function cleanup(client: PoolClient, projectId: string): Promise<number> {
  const rows = (await client.query<{ id: string }>(`SELECT r.id FROM flow.attachment_resources r WHERE r.project_id=$1 AND r.expires_at<=clock_timestamp()
    AND NOT EXISTS(SELECT 1 FROM flow.conversation_attachment_bindings b WHERE b.resource_id=r.id) ORDER BY r.id LIMIT $2 FOR UPDATE`, [projectId, limits.resourcesPerProject])).rows;
  if (!rows.length) return 0;
  return (await client.query('DELETE FROM flow.attachment_resources WHERE project_id=$1 AND id=ANY($2::uuid[])', [projectId, rows.map(row => row.id)])).rowCount!;
}
export async function cleanupExpiredAttachments(pool: Pool, projectId: string): Promise<number> {
  return transaction(pool, async client => { await loadProject(client, projectId, true); await namespace(client); return cleanup(client, projectId); });
}
export async function attachmentCapabilities(pool: Pool, projectId: string): Promise<AttachmentCapabilities> {
  return transaction(pool, async client => {
    await loadProject(client, projectId);
    return { protocol: 'text-v1', recoveryScopeId: await namespace(client), projectId, requiresProject: true,
      mediaTypes: ['text/plain'], extensions: ['.txt'], maxFileBytes: 8192, maxCombinedReferences: 4, maxCombinedBytes: 8192,
      order: 'knowledge-then-attachments', unboundTtlSeconds: limits.unboundTtlSeconds,
      resourcesPerProject: limits.resourcesPerProject, retainedBytesPerProject: limits.retainedBytesPerProject };
  }, true);
}
export async function publishAttachment(pool: Pool, projectId: string, input: AttachmentUpload, key: string): Promise<AttachmentAccepted> {
  if (!attachmentUploadKeySchema.safeParse(key).success) throw new HttpError(400, 'idempotency_key_required', 'Use a visible ASCII upload key without whitespace.');
  if (!attachmentUploadSchema.safeParse(input).success) throw new HttpError(400, 'invalid_attachment_request', 'Invalid bounded text upload.');
  if (sha256(input.text) !== input.contentDigest) throw new HttpError(400, 'attachment_digest_mismatch', 'The digest does not describe the original text.');
  return transaction(pool, async client => {
    const request = { projectId, ...input };
    const result = await commandInTransaction(client, `attachment.upload:${projectId}`, key, request, async (): Promise<AttachmentReceipt> => {
      await loadProject(client, projectId, true);
      const recoveryScopeId = await namespace(client);
      if (input.recoveryScopeId !== recoveryScopeId) throw new HttpError(409, 'attachment_scope_mismatch', 'Reconnect to the original resource namespace.');
      await cleanup(client, projectId);
      const capacity = (await client.query<{ count: string; bytes: string }>('SELECT count(*) AS count,coalesce(sum(byte_length),0) AS bytes FROM flow.attachment_resources WHERE project_id=$1', [projectId])).rows[0]!;
      if (Number(capacity.count) >= limits.resourcesPerProject || Number(capacity.bytes) + input.byteLength > limits.retainedBytesPerProject) throw new HttpError(409, 'attachment_budget', 'The project attachment storage limit is reached. Retained material cannot be removed.');
      const id = randomUUID();
      await client.query('INSERT INTO flow.attachment_resources(id,project_id,name,media_type,content,content_digest) VALUES($1,$2,$3,$4,$5,$6)', [id, projectId, input.name, input.mediaType, input.text, input.contentDigest]);
      return { uploadKey: key, recoveryScopeId, requestDigest: sha256(canonical(request)), resource: metadata(await resource(client, projectId, id)) };
    });
    return { ...result.value, replayed: result.replayed };
  });
}
export async function listAttachments(pool: Pool, projectId: string, limit: number, after?: string, query?: string): Promise<AttachmentList> {
  return transaction(pool, async client => {
    await loadProject(client, projectId); await namespace(client);
    const rows = (await client.query<ResourceRow>(`SELECT ${metadataColumns} FROM flow.attachment_resources r WHERE r.project_id=$1 AND r.expires_at>clock_timestamp()
      AND ($2::uuid IS NULL OR r.id>$2) AND ($3::text IS NULL OR strpos(lower(r.name),lower($3))>0) ORDER BY r.id LIMIT $4`, [projectId, after ?? null, query ?? null, limit + 1])).rows;
    return { resources: rows.slice(0, limit).map(metadata), nextCursor: rows.length > limit ? rows[limit - 1]!.id : null };
  }, true);
}
export async function attachmentMetadata(pool: Pool, projectId: string, id: string): Promise<AttachmentMetadata> {
  return transaction(pool, async client => { await loadProject(client, projectId); await namespace(client); return metadata(await resource(client, projectId, id)); }, true);
}
export async function attachmentContent(pool: Pool, projectId: string, id: string, version: number, digest: string): Promise<AttachmentContent> {
  return transaction(pool, async client => {
    await loadProject(client, projectId); await namespace(client); const row = await resource(client, projectId, id, true);
    if (version !== row.version || digest !== row.content_digest) throw mismatch();
    if (row.expired && !row.retained) throw new HttpError(410, 'attachment_expired', 'The unused attachment has expired.');
    const result = { ...descriptor(row), text: exactText(row) };
    if (Buffer.byteLength(JSON.stringify(result)) > limits.contentResponseBytes) throw new HttpError(413, 'attachment_too_large', 'The encoded content exceeds its response budget.');
    return result;
  }, true);
}
export async function attachmentReceipt(pool: Pool, projectId: string, scope: string, key: string): Promise<AttachmentReceiptLookup> {
  return transaction(pool, async client => {
    await loadProject(client, projectId);
    if (scope !== await namespace(client)) throw new HttpError(409, 'attachment_scope_mismatch', 'This is a different attachment namespace.');
    const saved = (await client.query<{ response: AttachmentReceipt }>('SELECT response FROM flow.commands WHERE operation=$1 AND key=$2', [`attachment.upload:${projectId}`, key])).rows[0]?.response;
    if (!saved) throw new HttpError(404, 'attachment_upload_receipt_not_found', 'No committed upload receipt is currently visible. This does not prove the request was never accepted.');
    const row = (await client.query<ResourceRow>(`SELECT ${metadataColumns} FROM flow.attachment_resources r WHERE r.project_id=$1 AND r.id=$2`, [projectId, saved.resource.reference.resourceId])).rows[0];
    return { receipt: saved, current: row ? { state: row.expired ? 'expired' : 'ready', retained: row.retained } : { state: 'unavailable', retained: null } };
  }, true);
}
/** Locks ready immutable resources within admission; binding insertion commits with the context. */
export async function freezeAttachments(client: PoolClient, projectId: string, references: readonly AttachmentReference[]): Promise<FrozenAttachment[]> {
  const refs = attachmentSelectionSchema.parse(references);
  if (refs.some(ref => ref.projectId !== projectId)) throw mismatch();
  await loadProject(client, projectId, true); await namespace(client);
  await client.query('SELECT id FROM flow.attachment_resources WHERE project_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR UPDATE', [projectId, refs.map(ref => ref.resourceId)]);
  const values: FrozenAttachment[] = [];
  for (const ref of refs) {
    const row = await resource(client, projectId, ref.resourceId, true);
    if (row.version !== ref.version || row.content_digest !== ref.contentDigest) throw mismatch();
    if (row.expired) throw new HttpError(410, 'attachment_expired', 'An attachment expired before this new admission. Existing receipts remain valid.');
    values.push({ ...descriptor(row), text: exactText(row) });
  }
  return values;
}
export async function bindAttachments(client: PoolClient, contextId: string, attachments: readonly FrozenAttachment[]): Promise<void> {
  for (const [ordinal, item] of attachments.entries()) await client.query('INSERT INTO flow.conversation_attachment_bindings(context_id,ordinal,resource_id) VALUES($1,$2,$3)', [contextId, ordinal, item.reference.resourceId]);
}
