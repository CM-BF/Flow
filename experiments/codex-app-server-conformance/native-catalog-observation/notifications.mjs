// Exact public wire names from fixed 0.154 ServerNotification.ts; recognizing a name does not permit it.
const publicMethods = new Set(["account/login/completed","account/rateLimits/updated","account/updated","app/list/updated","autoApprovalReview/strictReviewRequired","command/exec/outputDelta","configWarning","deprecationNotice","error","externalAgentConfig/import/completed","externalAgentConfig/import/progress","fs/changed","fuzzyFileSearch/sessionCompleted","fuzzyFileSearch/sessionUpdated","guardianWarning","hook/completed","hook/started","item/agentMessage/delta","item/autoApprovalReview/completed","item/autoApprovalReview/started","item/commandExecution/outputDelta","item/commandExecution/terminalInteraction","item/completed","item/fileChange/outputDelta","item/fileChange/patchUpdated","item/mcpToolCall/progress","item/plan/delta","item/reasoning/summaryPartAdded","item/reasoning/summaryTextDelta","item/reasoning/textDelta","item/started","mcpServer/event/stream/notification","mcpServer/oauthLogin/completed","mcpServer/startupStatus/updated","model/rerouted","model/safetyBuffering/updated","model/verification","modelProvider/authRecoveryCompleted","modelProvider/authRecoveryStarted","process/exited","process/outputDelta","project/changed","rawResponse/completed","rawResponseItem/completed","remoteControl/status/changed","serverRequest/resolved","skills/changed","thread/archived","thread/closed","thread/compacted","thread/deleted","thread/environment/connected","thread/environment/disconnected","thread/goal/cleared","thread/goal/updated","thread/name/updated","thread/project/updated","thread/queue/changed","thread/realtime/closed","thread/realtime/error","thread/realtime/item/completed","thread/realtime/item/started","thread/realtime/item/transcript/delta","thread/realtime/itemAdded","thread/realtime/outputAudio/delta","thread/realtime/sdp","thread/realtime/started","thread/realtime/transcript/delta","thread/realtime/transcript/done","thread/reverted","thread/settings/updated","thread/started","thread/status/changed","thread/tokenUsage/updated","thread/unarchived","turn/completed","turn/diff/updated","turn/moderationMetadata","turn/plan/updated","turn/started","warning","windows/worldWritableWarning","windowsSandbox/setupCompleted"]);
const permitted = new Set(['configWarning', 'deprecationNotice']);
export const notificationBounds = Object.freeze({ count: 8, serializedValueBytes: 131072, summaryBytes: 2048 });

export function recordNotification(result, message) {
  // Re-encoded decoded R06 Inbound value, not cumulative wire bytes. Never retain params or an arbitrary method.
  const serializedValueBytes = Buffer.byteLength(JSON.stringify(message));
  result.notificationCount++; result.notificationValueBytes += serializedValueBytes;
  const knownMethod = message.kind === 'notification' && publicMethods.has(message.method) ? message.method : null;
  const classification = knownMethod === null ? 'UNKNOWN' : permitted.has(knownMethod) ? 'PERMITTED_NAME' : 'KNOWN_UNEXPECTED';
  const withinLimit = result.notificationCount <= notificationBounds.count
    && result.notificationValueBytes <= notificationBounds.serializedValueBytes;
  const decision = withinLimit && classification === 'PERMITTED_NAME' ? 'continue' : 'stop';
  if (result.notificationCount <= notificationBounds.count) {
    const summary = { ordinal: result.notificationCount, knownMethod, classification, serializedValueBytes, decision, payloadValidated: false };
    const next = [...result.notificationSummaries, summary];
    if (Buffer.byteLength(JSON.stringify(next)) <= notificationBounds.summaryBytes) result.notificationSummaries = next;
    else result.notificationSummaryLimit = true;
  } else result.notificationOverflow = true;
  return decision === 'continue' && !result.notificationSummaryLimit;
}
