# CHAT05 frozen initial interface

`packages/contracts/src/native-activity.ts` exports `nativeActivityDataSchema`, `NativeActivityData`, `NativeActivityReference`, `NativeActivity`, `NativeActivityPage`. Wire event is `type: native-activity`, source `claude.sdk.message`; common runner envelope supplies id/sequence. Center derives task/attempt. SDK source UUID + block index + kind + session fixes activityId; parentToolUseId and toolUseId are explicit.

Owner routes: `GET /api/tasks/:id/native-activities?after=<activityId>&limit=20` (max100), `GET /api/native-activities/:id`. Page entries contain no body. `phase` is the immutable observation; `status` is latest observed tool state, or unknown if unresolved after task/attempt stopped or became uncertain. Input-ready is never success. Successful tool_result is an SDK result observation, not independent verification of external effects.

Timeline reference retains id/title, with optional `activity:{kind:'native-activity',activityId}`. Existing timeline JSON persistence spreads the reference without reconstruction; HTTP test must verify this metadata survives. Generic detail fallback remains readable for older clients.

Body is UTF-8 bounded to 65536 bytes with explicit truncated/originalBytes/sha256. sha256 is the full original allowed content digest; when truncated the center cannot attest unseen bytes. Public thinking text may be stored; signatures and redacted payload never are. Missing thinking yields no invented event. Unsupported blocks carry only their type, not arbitrary opaque payload. SDK partial stream events are ignored in this first complete-frame slice. assistant-text activity is not the final conversation reply.

Seams: `mapNativeActivity(frame, nativeSessionId)` → events; `saveNativeActivity(client,task,attempt,event)` in existing report transaction; `migrateNativeActivities(pool)` and `registerNativeActivityRoutes(app,pool)` for Lead mount. Adapter/runner schema wiring follows O07 scope handback. No new model, scheduler, transport or tool grant.
