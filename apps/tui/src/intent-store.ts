import { intentSchema, type IntentStore } from '@flow/interaction';
import { openPrivateJournal } from './private-journal.js';

/** Preserve the original connection filename and conversation codec. */
export async function openIntentStore(directory: string, connectionId: string): Promise<IntentStore & { close(): Promise<void> }> {
  if (!/^[a-f0-9]{64}$/.test(connectionId)) throw new Error('Invalid private intent location');
  return openPrivateJournal(directory, connectionId, value => {
    const intent = intentSchema.parse(value);
    if (intent.connectionId !== connectionId) throw new Error('Intent connection mismatch');
    return intent;
  });
}
