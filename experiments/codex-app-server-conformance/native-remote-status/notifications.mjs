import { recordNotification as recordBaseNotification, notificationBounds } from '../native-catalog-observation/notifications.mjs';

export { notificationBounds };
const method = 'remoteControl/status/changed';
const fields = ['status', 'serverName', 'installationId', 'environmentId'];
const statuses = new Set(['disabled', 'connecting', 'connected', 'errored']);

// Fixed 0.154 shape only. Identity strings are validated in memory and never retained in a safe summary.
export function remoteControlStatusIsValid(params) {
  if (params === null || typeof params !== 'object' || Array.isArray(params)) return false;
  const prototype = Object.getPrototypeOf(params);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const keys = Object.keys(params);
  return keys.length === fields.length && fields.every(field => Object.hasOwn(params, field))
    && statuses.has(params.status) && typeof params.serverName === 'string'
    && typeof params.installationId === 'string'
    && (params.environmentId === null || typeof params.environmentId === 'string');
}

export function recordNotification(result, message) {
  const baseDecision = recordBaseNotification(result, message);
  if (message.kind !== 'notification' || message.method !== method) return baseDecision;
  const previous = result.notificationSummaries.at(-1);
  if (!previous || previous.ordinal !== result.notificationCount || previous.knownMethod !== method) return false;
  const payloadValidated = remoteControlStatusIsValid(message.params);
  const withinBounds = !result.notificationSummaryLimit && !result.notificationOverflow
    && result.notificationCount <= notificationBounds.count
    && result.notificationValueBytes <= notificationBounds.serializedValueBytes;
  const summary = { ...previous, classification: payloadValidated ? 'REMOTE_STATUS_VALIDATED' : 'REMOTE_STATUS_INVALID',
    decision: payloadValidated && withinBounds ? 'continue' : 'stop', payloadValidated };
  const summaries = [...result.notificationSummaries.slice(0, -1), summary];
  if (Buffer.byteLength(JSON.stringify(summaries)) > notificationBounds.summaryBytes) {
    result.notificationSummaryLimit = true; return false;
  }
  result.notificationSummaries = summaries;
  return summary.decision === 'continue';
}
