import { FlowApiError } from '@flow/client';
import { GoalToolError } from '../goal-tools/index.js';

export class ReadError extends Error {
  constructor(readonly code: 'stale_snapshot' | 'not_available') { super(code); }
}
function textResult(value: unknown) { return { content: [{ type: 'text' as const, text: JSON.stringify(value) }] }; }
/** Bound the encoded MCP result, including escaping, rather than claiming a token budget. */
export function result(value: unknown) {
  const response = textResult(value);
  if (Buffer.byteLength(JSON.stringify(response), 'utf8') > 65_536) {
    return { ...textResult({ error: 'response_too_large', message: 'Response exceeds 64 KiB; nothing was truncated. A command may already be committed: reconcile with its original idempotency key.' }), isError: true };
  }
  return response;
}
export function failure(error: unknown) {
  if (error instanceof GoalToolError || error instanceof ReadError) {
    return { ...textResult({ error: error.code }), isError: true };
  }
  if (error instanceof FlowApiError && [400, 401, 403, 404, 409, 422].includes(error.status)) {
    return { ...textResult({ error: 'center_rejected', status: error.status }), isError: true };
  }
  return { ...textResult({ error: 'outcome_unknown', message: 'The request could not be completed. For a command, reconcile using the same idempotency key. No automatic retry was performed.' }), isError: true };
}
