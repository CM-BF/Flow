import { randomUUID } from 'node:crypto';
import { CLAUDE_TURN_SETTINGS_PROTOCOL, type ClaudeMessageSettingsCatalogPage, type ClaudeTurnSettings,
  type ConversationSnapshot, type ConversationTurn, type ConversationTurnAdmission, type ConversationTurnAccepted } from '@flow/contracts';
import { createInteractionController } from '../controller.js';
import type { Intent, IntentStore, InteractionClient } from '../types.js';
import type { MessageSettingsPort } from './index.js';

export function settingsFixture() {
  const reference = { id: randomUUID(), runnerId: randomUUID(), configDigest: 'a'.repeat(64) };
  const choices: ClaudeTurnSettings['requested'][] = [
    { model: 'sonnet', thinking: 'adaptive', effort: { kind: 'level', value: 'high' }, speed: 'standard' },
    { model: 'opus', thinking: 'disabled', effort: { kind: 'not-requested' }, speed: 'fast' },
  ];
  const catalog: ClaudeMessageSettingsCatalogPage = { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, nextCursor: null, profiles: [{
    profile: { reference, configuration: { harness: 'claude', adapterVersion: 'claude-sdk-0.3.290-v2', model: 'sonnet', thinking: 'disabled',
      permissionMode: 'dontAsk', access: 'none', requireReadApproval: false, materialScopeDigest: '0'.repeat(64),
      limits: { maxTurns: 1, maxBudgetUsd: 0.1, timeoutMs: 1000 }, turnSettings: { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, choices } },
      source: 'runner-configured', availability: 'not-probed', model: { value: 'sonnet', resolvedModel: null, displayName: 'sonnet', description: 'Configured only', providerCapabilities: 'unknown' },
      controls: { access: 'configured-policy', queue: false, steer: false, messageSettings: { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, choices: 'configuration.turnSettings.choices' } },
      createdAt: '2026-10-06T00:00:00.000Z' }, conversation: { state: 'existing-claude-contract', capabilitySource: 'conversation-response' },
  }] };
  const snapshot: ConversationSnapshot = { conversation: { id: randomUUID(), title: 'Settings', harness: 'claude', executionProfile: reference,
    requested: { model: 'sonnet', thinking: 'disabled', tools: 'none' }, revision: 0, createdAt: '2026-10-06T00:00:00.000Z', updatedAt: '2026-10-06T00:00:00.000Z' },
    capabilities: { followUp: true, queue: false, steer: false, perTurnModel: false, perTurnThinking: false, perTurnTools: false,
      messageSettings: { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, profile: reference, choices: 'execution-profile' } }, nativeSession: null, lastTurn: null };
  const accepted = (input: ConversationTurnAdmission): ConversationTurnAccepted => {
    const taskId = randomUUID(); const number = input.expectedRevision + 1;
    const turn: ConversationTurn = { id: randomUUID(), conversationId: snapshot.conversation.id, number, createdAt: '2026-10-06T00:00:00.000Z',
      user: { role: 'user', text: input.text }, task: { id: taskId, title: 'Turn', harness: 'claude', status: 'queued', verificationStatus: 'pending', createdAt: '2026-10-06T00:00:00.000Z', updatedAt: '2026-10-06T00:00:00.000Z' },
      assistant: { state: 'pending', reason: 'execution-pending' }, effective: { model: null, thinking: 'unknown', tools: null, source: null },
      telemetry: { kind: 'execution', taskId, title: 'Turn' }, ...(input.messageSettings ? { messageSettings: structuredClone(input.messageSettings) } : {}) };
    return { conversation: { ...snapshot.conversation, revision: number }, turn, replayed: false };
  };
  return { reference, choices, catalog, snapshot, accepted };
}
export function controlledSettings(f = settingsFixture(), overrides: Partial<InteractionClient & MessageSettingsPort> = {}, initial: Intent | null = null) {
  let saved = initial; const calls: { input: ConversationTurnAdmission; key: string }[] = []; const reads: unknown[] = [];
  const intents: IntentStore = { load: async () => saved, save: async value => { saved = structuredClone(value); }, clear: async () => { saved = null; } };
  const client: InteractionClient & MessageSettingsPort = {
    conversations: async () => ({ conversations: [f.snapshot.conversation], nextCursor: null }),
    conversation: async () => structuredClone(f.snapshot), conversationTurns: async () => ({ conversation: structuredClone(f.snapshot.conversation), turns: f.snapshot.lastTurn ? [structuredClone(f.snapshot.lastTurn)] : [], nextCursor: null }),
    executionProfiles: async () => ({ profiles: [], nextCursor: null }),
    claudeMessageSettingsProfiles: async (options, signal) => { reads.push({ options, signal }); return f.catalog; },
    createConversation: async input => ({ conversation: { ...f.snapshot.conversation, ...input }, capabilities: { ...f.snapshot.capabilities, messageSettings: undefined }, replayed: false }),
    submitConversationTurn: async (_id, input, key) => { calls.push({ input: structuredClone(input), key }); return f.accepted(input); }, ...overrides,
  };
  const controller = createInteractionController({ client, messageSettings: client, connectionId: 'settings-test', intents, pollMs: 60_000 });
  return { f, client, controller, intents, calls, reads, saved: () => saved };
}
export async function selectFirst(value: ReturnType<typeof controlledSettings>) {
  await value.controller.initialize(); await value.controller.execute({ type: 'open', id: value.f.snapshot.conversation.id });
  await value.controller.execute({ type: 'settings' });
  return value.controller.execute({ type: 'setting', profileId: value.f.reference.id, choice: 1 });
}
