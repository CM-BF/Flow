import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { idSchema } from '../../../../packages/contracts/src/tasks.js';
import { attachmentReferenceSchema, attachmentUploadSchema, attachmentListQuerySchema, attachmentReceiptQuerySchema, attachmentContentQuerySchema } from '../../../../packages/contracts/src/attachments.js';
import { HttpError, transaction } from '../database.js';
import { attachmentCapabilities, attachmentContent, attachmentMetadata, attachmentReceipt, listAttachments, publishAttachment } from './storage.js';

/** After projects/context migrations, before routes/listen. The shared mount is owned separately. */
export async function migrateAttachments(pool: Pool): Promise<void> {
  await transaction(pool, async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('flow-migrations',0))");
    if ((await client.query('SELECT 1 FROM flow.migrations WHERE version=26')).rowCount) return;
    await client.query(await readFile(new URL('../../../../packages/storage/migrations/026-attachment-resources.sql', import.meta.url), 'utf8'));
    await client.query('INSERT INTO flow.attachment_namespace(singleton,recovery_scope_id) VALUES(true,$1)', [randomUUID()]);
    await client.query('INSERT INTO flow.migrations(version) VALUES(26)');
  });
}
function upload(value: unknown) {
  if (typeof value === 'object' && value !== null) {
    const input = value as Record<string, unknown>;
    if (typeof input.mediaType === 'string' && input.mediaType !== 'text/plain' || typeof input.name === 'string' && !input.name.toLowerCase().endsWith('.txt')) throw new HttpError(415, 'attachment_type_unsupported', 'Only UTF-8 .txt text/plain files are supported.');
    if (typeof input.text === 'string' && Buffer.byteLength(input.text) > 8192) throw new HttpError(413, 'attachment_too_large', 'The complete file must fit within 8192 UTF-8 bytes.');
  }
  return parse(attachmentUploadSchema, value);
}
function parse<T>(schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } }, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError(400, 'invalid_attachment_request', 'Invalid text attachment request.');
  return result.data;
}
type Project = { projectId: string };
type Resource = Project & { resourceId: string };
/** Register inside existing center owner authentication; never grants runner credentials owner access. */
export function registerAttachmentRoutes(app: FastifyInstance, pool: Pool): void {
  // Encapsulation keeps strict UTF-8 decoding local to upload routes, not other center APIs.
  void app.register(async routes => {
    routes.removeContentTypeParser('application/json');
    routes.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_request, body, done) => {
      try {
        if (!Buffer.isBuffer(body)) throw Error('Expected raw upload bytes.');
        done(null, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)));
      }
      catch { done(new HttpError(400, 'invalid_attachment_request', 'Upload JSON must contain valid UTF-8.')); }
    });
    routes.get<{ Params: Project }>('/api/projects/:projectId/attachments/capabilities', request => attachmentCapabilities(pool, parse(idSchema, request.params.projectId)));
    routes.post<{ Params: Project }>('/api/projects/:projectId/attachments', { bodyLimit: 65_536 }, async (request, reply) => reply.code(201).send(await publishAttachment(pool, parse(idSchema, request.params.projectId), upload(request.body), String(request.headers['idempotency-key'] ?? ''))));
    routes.get<{ Params: Project }>('/api/projects/:projectId/attachments', request => {
      const query = parse(attachmentListQuerySchema, request.query);
      return listAttachments(pool, parse(idSchema, request.params.projectId), query.limit, query.after, query.q);
    });
    routes.get<{ Params: Project }>('/api/projects/:projectId/attachments/upload-receipt', request => {
      const query = parse(attachmentReceiptQuerySchema, request.query);
      return attachmentReceipt(pool, parse(idSchema, request.params.projectId), query.scope, query.key);
    });
    routes.get<{ Params: Resource }>('/api/projects/:projectId/attachments/:resourceId', request => attachmentMetadata(pool, parse(idSchema, request.params.projectId), parse(attachmentReferenceSchema.shape.resourceId, request.params.resourceId)));
    routes.get<{ Params: Resource & { version: string } }>('/api/projects/:projectId/attachments/:resourceId/versions/:version/content', request => {
      const query = parse(attachmentContentQuerySchema, request.query);
      return attachmentContent(pool, parse(idSchema, request.params.projectId), parse(attachmentReferenceSchema.shape.resourceId, request.params.resourceId), parse(attachmentReferenceSchema.shape.version, Number(request.params.version)), query.digest);
    });
  });
}
