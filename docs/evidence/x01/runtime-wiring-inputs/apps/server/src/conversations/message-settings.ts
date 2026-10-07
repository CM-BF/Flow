import type { TaskSubmission } from '../../../../packages/contracts/src/tasks.js';
import type { NativeExecutionProfile } from '../../../../packages/contracts/src/execution-profiles.js';
import { checkClaudeTurnSettingsAllowed, claudeTurnSettingsSchema, type ClaudeTurnSettings } from '../../../../packages/contracts/src/claude-turn-settings.js';

export type MessageSettingsAdmissionCode = 'message_settings_required' | 'message_settings_invalid'
  | 'message_settings_unavailable' | 'message_settings_unsupported' | 'message_settings_profile_mismatch' | 'message_settings_resume_unsupported';
export type MessageSettingsAdmission = { ok: true; snapshot?: ClaudeTurnSettings } | { ok: false; code: MessageSettingsAdmissionCode };

/** No database or HTTP policy here. The caller supplies its authenticated immutable profile. */
export function checkTaskMessageSettings(task: TaskSubmission, profile: NativeExecutionProfile | null): MessageSettingsAdmission {
  const configuration = profile?.configuration;
  const policy = configuration?.harness === 'claude' ? configuration.turnSettings : undefined;
  if (!task.messageSettings) return policy ? { ok: false, code: 'message_settings_required' } : { ok: true };
  const parsed = claudeTurnSettingsSchema.safeParse(task.messageSettings);
  if (!parsed.success) return { ok: false, code: 'message_settings_invalid' };
  const snapshot = parsed.data;
  if (!profile) return { ok: false, code: 'message_settings_unavailable' };
  if (task.harness !== 'claude' || task.fixture || task.protocol || task.engineering || !policy
    || configuration?.harness !== 'claude' || configuration.activeSteering || !['none', 'configured-readonly'].includes(configuration.access)) {
    return { ok: false, code: 'message_settings_unsupported' };
  }
  const selected = task.executionProfile;
  if (!selected || selected.id !== profile.reference.id || selected.runnerId !== profile.reference.runnerId || selected.configDigest !== profile.reference.configDigest) {
    return { ok: false, code: 'message_settings_profile_mismatch' };
  }
  const decision = checkClaudeTurnSettingsAllowed(snapshot, { profile: profile.reference, choices: policy.choices });
  if (decision.decision !== 'allowed') {
    return { ok: false, code: decision.decision === 'profile-mismatch' ? 'message_settings_profile_mismatch'
      : decision.decision === 'unknown' ? 'message_settings_unavailable' : 'message_settings_unsupported' };
  }
  // The persisted session may contain a previous effort. Omission does not prove its reset.
  if (task.resumeSessionId && snapshot.requested.effort.kind === 'not-requested') return { ok: false, code: 'message_settings_resume_unsupported' };
  return { ok: true, snapshot };
}
