export const MAX_RESIDENT_CONVERSATIONS = 32;

/** App owns the views and gathers these facts from their existing controllers. */
export interface RetentionFacts {
  text: string;
  unsubmittedProfile: boolean;
  hasOutbox: boolean;
  queueReceipts: number;
  host: readonly string[];
  pendingSubmission?: boolean;
}
export function retentionReasons(facts: RetentionFacts): string[] {
  return [
    ...(facts.text.length ? ["Unsent draft"] : []),
    ...(facts.unsubmittedProfile ? ["Execution selection"] : []),
    ...(facts.pendingSubmission ? ["Message preparation"] : []),
    ...(facts.hasOutbox ? ["Message receipt"] : []),
    ...(facts.queueReceipts ? ["Queue receipts"] : []),
    ...facts.host,
  ];
}
export function canOpenConversation(residentCount: number, alreadyResident: boolean): boolean {
  return alreadyResident || residentCount < MAX_RESIDENT_CONVERSATIONS;
}
