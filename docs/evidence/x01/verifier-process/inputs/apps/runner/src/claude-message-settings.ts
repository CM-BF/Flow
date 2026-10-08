import type { Options, SDKSystemMessage } from '@anthropic-ai/claude-agent-sdk';
import { claudeTurnSettingsSchema, type ClaudeTurnSettings } from '../../../packages/contracts/src/claude-turn-settings.js';
import { claudeAssistantSettingsSchema, claudeMessageSettingsFinalSchema, type AssistantSettings, type ClaudeAssistantSettings, type ClaudeMessageSettingsFinal } from '../../../packages/contracts/src/assistant.js';

/** Only these request controls are replaced; the caller retains permissions, environment and lifecycle. */
export function claudeMessageOptions(value: ClaudeTurnSettings, resumeSessionId?: string): Pick<Options, 'model' | 'thinking' | 'effort'> & { settings: { fastMode: boolean; fastModePerSessionOptIn: true } } {
  const { requested } = claudeTurnSettingsSchema.parse(value);
  if (resumeSessionId && requested.effort.kind === 'not-requested') throw new Error('A resumed Claude message requires an explicit effort level.');
  return {
    model: requested.model,
    thinking: { type: requested.thinking },
    ...(requested.effort.kind === 'level' ? { effort: requested.effort.value } : {}),
    settings: { fastMode: requested.speed === 'fast', fastModePerSessionOptIn: true },
  };
}

/** Select finite init facts only. Call for each init; never merge omitted fields from earlier frames. */
export function claudeMessageObservation(init: SDKSystemMessage, nativeSessionId: string): NonNullable<ClaudeMessageSettingsFinal['observed']> {
  if (init.type !== 'system' || init.subtype !== 'init' || init.session_id !== nativeSessionId) throw new Error('Claude settings initialization did not match its native session.');
  return claudeMessageSettingsFinalSchema.shape.observed.unwrap().parse({
    source: 'claude.sdk.system.init', model: init.model,
    ...(init.effort !== undefined ? { effort: init.effort } : {}),
    ...(init.fast_mode_state !== undefined ? { fastModeState: init.fast_mode_state } : {}),
    ...(init.fast_mode_disabled_reason !== undefined ? { fastModeDisabledReason: init.fast_mode_disabled_reason } : {}),
  });
}

export function claudeMessageFinalSettings(snapshot: ClaudeTurnSettings, observed: ClaudeMessageSettingsFinal['observed'], effective: AssistantSettings['effective']): ClaudeAssistantSettings {
  return claudeAssistantSettingsSchema.parse({ effective, messageSettings: { snapshot, observed } });
}
