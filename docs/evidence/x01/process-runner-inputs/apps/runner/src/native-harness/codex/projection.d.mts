export interface OrdinaryFinal {
  source: 'codex.app-server.agent-message';
  nativeSessionId: string;
  nativeTurnId: string;
  nativeItemId: string;
  sourceMessageId: string;
  messageId: string;
  text: string;
}
export type OrdinaryFinalObservation =
  | { state: 'completed'; final: OrdinaryFinal; actualExecution: 'unknown' }
  | { state: 'pending' | 'unknown' | 'unsupported' | 'failed' | 'interrupted'; final: null; reason?: string };
/** May throw an AssertionError carrying raw evidence. Hosts must normalize without logging or retaining it. */
export function createOrdinaryFinalProjection(expected: { threadId: string; turnId: string }): {
  accept(notification: unknown): OrdinaryFinalObservation;
};
