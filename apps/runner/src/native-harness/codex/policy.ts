import type { Reply } from '../../codex/types.js';

/** Denies every fixed 0.154.0 server-request method; no request is delegated to a user or tool. */
export function denyCodexRequest(method: string): Reply {
  switch (method) {
    case 'item/commandExecution/requestApproval':
    case 'item/fileChange/requestApproval':
      return { result: { decision: 'decline' } };
    case 'item/permissions/requestApproval':
      return { result: { permissions: {}, scope: 'turn', strictAutoReview: true } };
    case 'item/tool/call':
      return { result: { contentItems: [], success: false } };
    case 'mcpServer/elicitation/request':
      return { result: { action: 'decline', content: null, _meta: null } };
    case 'execCommandApproval':
    case 'applyPatchApproval':
      return { result: { decision: 'abort' } };
    case 'item/tool/requestUserInput':
    case 'account/chatgptAuthTokens/refresh':
    case 'attestation/generate':
      return { error: { code: -32601, message: 'Unsupported ordinary-task request.' } };
    default:
      return { error: { code: -32601, message: 'Unknown server request.' } };
  }
}

const ordinaryItemTypes = new Set(['userMessage', 'agentMessage', 'reasoning', 'plan']);

/** Checks every started/completed item and every terminal item, including non-agent messages.
 * Observation of a tool is a policy violation, never evidence that it was prevented. */
export function assertOrdinaryItem(item: unknown): void {
  if (!item || Array.isArray(item) || typeof item !== 'object'
    || !('type' in item) || typeof item.type !== 'string' || !ordinaryItemTypes.has(item.type)) {
    throw new Error('Unsupported item in an ordinary native task.');
  }
}
