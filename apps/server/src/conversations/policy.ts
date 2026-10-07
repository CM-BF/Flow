import type { NativeExecutionProfile } from '../../../../packages/contracts/src/execution-profiles.js';
import type { ConversationCreation } from '../../../../packages/contracts/src/conversations.js';
import { HttpError } from '../database.js';

/** Creation binds supported intent; native execution facts remain unknown until separately observed. */
export function assertConversationProfile(input: ConversationCreation, profile?: NativeExecutionProfile): void {
  const config = profile?.configuration;
  if (config && config.harness !== input.harness) throw new HttpError(409, 'profile_harness_mismatch', 'The profile and conversation harness must match.');
  if (input.harness === 'codex') {
    if (!config || config.harness !== 'codex' || config.sessionPersistence !== 'host-owned') throw new HttpError(409, 'native_resume_unsupported', 'Codex conversations require a host-owned persistent profile.');
    if (input.requested.thinking !== 'unknown' || input.requested.tools !== 'none') throw new HttpError(409, 'conversation_settings_unsupported', 'Native execution controls are not attested.');
  } else if (input.requested.thinking !== 'disabled' || (input.requested.tools !== 'configured-readonly' && config?.access !== 'none')) {
    throw new HttpError(409, 'conversation_settings_unsupported', 'The selected configuration cannot fulfill these requested controls.');
  }
  if (input.requested.model !== 'runner-default' && input.requested.model !== config?.model) throw new HttpError(409, 'conversation_settings_unsupported', 'The requested model must match the pinned profile.');
}
