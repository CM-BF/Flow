import {
  CLAUDE_TURN_SETTINGS_PROTOCOL, claudeMessageSettingsCatalogPageSchema, claudeMessageSettingsFinalSchema,
  claudeTurnSettingsSchema, assertClaudeTurnSettingsMatch, checkClaudeTurnSettingsAllowed, executionProfileReferenceSchema,
  type ClaudeMessageSettingsCatalogPage, type ClaudeTurnSettings, type ClaudeMessageSettingsFinal,
  type ConversationCapabilities, type ConversationSummary, type ConversationTurn,
} from '@flow/contracts';
import type { FlowClient } from '@flow/client';

export type MessageSettingsPort = Pick<FlowClient, 'claudeMessageSettingsProfiles'>;
export type SettingsProfile = ClaudeMessageSettingsCatalogPage['profiles'][number]['profile'];
export interface MessageSettingsView {
  supported: boolean;
  selected: ClaudeTurnSettings | null;
  profiles: { id: string; access: string; choices: string[] }[];
  selectionLabel: string | null;
  nextCursor: string | null;
  page: number;
}
export interface MessageSettingsEvidence {
  requested: ClaudeTurnSettings['requested'] | null;
  observed: ClaudeMessageSettingsFinal['observed'];
  thinking: 'unknown';
  requestedLabel: string;
  observedLabel: string;
}
export class MessageSettingsError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = 'MessageSettingsError'; }
}
const sameProfile = (a: ClaudeTurnSettings['profile'], b: ClaudeTurnSettings['profile']) =>
  a.id === b.id && a.runnerId === b.runnerId && a.configDigest === b.configDigest;

/** Optional capability is usable only when the current public conversation binds all three IDs. */
export function settingsProfile(conversation: ConversationSummary, capability: ConversationCapabilities['messageSettings']): ClaudeTurnSettings['profile'] | null {
  const profile = executionProfileReferenceSchema.safeParse(capability?.profile);
  const pinned = executionProfileReferenceSchema.safeParse(conversation.executionProfile);
  return conversation.harness === 'claude' && capability?.protocol === CLAUDE_TURN_SETTINGS_PROTOCOL && capability.choices === 'execution-profile'
    && profile.success && pinned.success && sameProfile(profile.data, pinned.data) ? profile.data : null;
}
export function readSettingsPage(raw: unknown): ClaudeMessageSettingsCatalogPage {
  const page = claudeMessageSettingsCatalogPageSchema.parse(raw);
  if (page.profiles.length > 6) throw new MessageSettingsError('INVALID_RESPONSE', 'Settings catalog page exceeded the requested limit.');
  return page;
}
export function selectSettings(page: ClaudeMessageSettingsCatalogPage | null, current: ClaudeTurnSettings['profile'] | null,
  profileId: string, choice: number): ClaudeTurnSettings {
  if (!current) throw new MessageSettingsError('UNSUPPORTED_SETTINGS', 'This conversation has no supported message settings capability.');
  const profile = page?.profiles.find(entry => entry.profile.reference.id === profileId)?.profile;
  if (!profile || !sameProfile(profile.reference, current)) throw new MessageSettingsError('SETTINGS_PROFILE_MISMATCH', 'Load the settings page for this conversation’s exact profile.');
  const requested = profile.configuration.turnSettings?.choices[choice - 1];
  if (!Number.isInteger(choice) || choice < 1 || !requested) throw new MessageSettingsError('SETTINGS_CHOICE_NOT_LOADED', 'Choose a numbered complete tuple from the loaded profile.');
  const selected = claudeTurnSettingsSchema.parse({ protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, profile: profile.reference, requested });
  if (checkClaudeTurnSettingsAllowed(selected, { profile: current, choices: profile.configuration.turnSettings!.choices }).decision !== 'allowed') {
    throw new MessageSettingsError('UNSUPPORTED_SETTINGS', 'The complete settings tuple is not allowed.');
  }
  return selected;
}
export function validateSelection(selected: ClaudeTurnSettings, current: ClaudeTurnSettings['profile'] | null): void {
  if (!current || !sameProfile(selected.profile, current)) throw new MessageSettingsError('SETTINGS_PROFILE_MISMATCH', 'The conversation capability changed. Select its current settings before sending.');
}
export function sameSettings(a: ClaudeTurnSettings | null, b: ClaudeTurnSettings | undefined): boolean {
  if (a === null || b === undefined) return false;
  try { assertClaudeTurnSettingsMatch(a, b); return true; } catch { return false; }
}

/** Public recorded evidence only. Catalog choices and requested settings never supply observed values. */
export function settingsEvidence(turn: ConversationTurn): MessageSettingsEvidence | undefined {
  if (turn.messageSettings === undefined && turn.effective.messageSettings === undefined) return undefined;
  const requested = claudeTurnSettingsSchema.safeParse(turn.messageSettings);
  const result: MessageSettingsEvidence = { requested: requested.success ? requested.data.requested : null, observed: null, thinking: 'unknown',
    requestedLabel: requested.success ? describeRequested(requested.data.requested) : 'unknown', observedLabel: 'unknown' };
  const final = claudeMessageSettingsFinalSchema.safeParse(turn.effective.messageSettings);
  const source = turn.effective.source; const reply = turn.assistant;
  if (!requested.success || !final.success || turn.effective.runnerRequested !== undefined || turn.effective.thinking !== 'unknown'
    || !sameSettings(requested.data, final.data.snapshot) || turn.effective.model !== (final.data.observed?.model ?? null)
    || source?.kind !== 'assistant-final' || source.taskId !== turn.task.id || reply.state !== 'available'
    || reply.source.kind !== 'assistant-final' || reply.source.source !== 'claude.sdk.result'
    || source.messageId !== reply.messageId || source.messageId !== reply.source.messageId
    || source.attemptId !== reply.source.attemptId || source.detailId !== reply.source.detailId
    || reply.source.taskId !== turn.task.id || reply.contentRef.taskId !== turn.task.id
    || reply.contentRef.attemptId !== source.attemptId || reply.contentRef.id !== source.detailId) return result;
  const observed = final.data.observed;
  return { ...result, observed, observedLabel: observed ? `${observed.model} · effort ${observed.effort ?? 'unknown'} · fast mode ${observed.fastModeState ?? 'unknown'}${observed.fastModeDisabledReason ? ` · fast mode reason ${observed.fastModeDisabledReason}` : ''} · thinking unknown (SDK init)` : 'unknown' };
}
export function describeRequested(value: ClaudeTurnSettings['requested']): string {
  return `${value.model} · thinking ${value.thinking} · effort ${value.effort.kind === 'level' ? value.effort.value : 'not requested'} · speed ${value.speed}`;
}
