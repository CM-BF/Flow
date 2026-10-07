/** Only used after the driver has verified normal runtime drain and all 129 persisted tasks/attempts. */
export function resolvedQueueJournal(value: unknown, runnerIds: ReadonlySet<string>): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return Object.keys(row).sort().join(',') === 'assignments,opportunityId,runnerId,version' && row.version === 2 &&
    typeof row.runnerId === 'string' && runnerIds.has(row.runnerId) && typeof row.opportunityId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.opportunityId) &&
    Array.isArray(row.assignments) && row.assignments.length === 0;
}
