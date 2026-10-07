/** Evidence extraction only; the production FlowClient remains the protocol decoder/authority. */
export type ObservedClaim = { taskId: string; attemptId: string; ownerVersion: number; runnerId: string };
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('mixed_claim_identity_conflict');
  return value as Record<string, unknown>;
};
const id = (value: unknown): string => {
  if (typeof value !== 'string' || !value.length || value.length > 128) throw new Error('mixed_claim_identity_conflict');
  return value;
};
const equal = (a: ObservedClaim, b: ObservedClaim) => a.taskId === b.taskId && a.attemptId === b.attemptId && a.runnerId === b.runnerId && a.ownerVersion === b.ownerVersion;
export function createClaimObservation(taskIds: readonly string[]) {
  const allowed = new Set(taskIds); const claims = new Map<string, ObservedClaim>(); const receipts = new Map<string, ObservedClaim>(); const liveKeys = new Set<string>();
  function observe(path: string, request: unknown, response: unknown, authenticatedRunner?: string) {
    const legacy = path === '/api/runner/claim';
    const status = path === '/api/runner/claim-opportunity/status';
    if (!legacy && !status && path !== '/api/runner/claim-opportunity') return;
    const body = object(response); let key: string | undefined;
    if (!legacy) {
      const sent = object(request);
      if (sent.protocol !== 'flow.runner-claim.v2' || body.protocol !== sent.protocol || !authenticatedRunner ||
          sent.runnerId !== authenticatedRunner || body.runnerId !== authenticatedRunner || body.requestId !== sent.requestId ||
          typeof sent.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sent.requestId)) throw new Error('mixed_claim_identity_conflict');
      key = authenticatedRunner + ':' + sent.requestId;
      if (body.state === 'unavailable') {
        const receipt = object(body.identity);
        const historical: ObservedClaim = { taskId: id(receipt.taskId), attemptId: id(receipt.attemptId), runnerId: id(receipt.runnerId), ownerVersion: receipt.ownerVersion as number };
        const previous = receipts.get(key);
        if (!allowed.has(historical.taskId) || historical.runnerId !== authenticatedRunner || !Number.isSafeInteger(historical.ownerVersion) || historical.ownerVersion < 1 || previous && !equal(previous, historical)) throw new Error('mixed_claim_identity_conflict');
        receipts.set(key, { ...historical });
        return; // A historical receipt is not a live assignment or execution authority.
      }
      if (body.state === (status ? 'missing' : 'empty')) {
        if (receipts.has(key) || body.assignment !== undefined) throw new Error('mixed_claim_identity_conflict');
        return;
      }
      if (body.state !== 'assigned') throw new Error('mixed_claim_identity_conflict');
    } else if (!body.assignment) return;
    const assignment = object(body.assignment); const attempt = object(assignment.attempt); const task = object(assignment.task);
    const claim = { taskId: id(task.id), attemptId: id(attempt.id), ownerVersion: attempt.ownerVersion as number, runnerId: id(attempt.runnerId) };
    if (!allowed.has(claim.taskId) || !Number.isSafeInteger(claim.ownerVersion) || claim.ownerVersion < 1 || authenticatedRunner && claim.runnerId !== authenticatedRunner) throw new Error('mixed_claim_identity_conflict');
    if (key) {
      const receipt = object(body.identity);
      if (!equal(claim, receipt as ObservedClaim)) throw new Error('mixed_claim_identity_conflict');
      const previous = receipts.get(key);
      if (previous) {
        if (!equal(previous, claim)) throw new Error('mixed_claim_identity_conflict');
        const live = claims.get(claim.taskId);
        if (live && liveKeys.has(key)) {
          if (!equal(live, claim)) throw new Error('mixed_claim_identity_conflict');
          return { claim: { ...claim }, replay: true, requestId: object(request).requestId as string };
        }
      }
    }
    if (claims.has(claim.taskId) || [...claims.values()].some(value => value.attemptId === claim.attemptId)) throw new Error('mixed_claim_identity_conflict');
    claims.set(claim.taskId, { ...claim }); if (key) { receipts.set(key, { ...claim }); liveKeys.add(key); }
    return { claim: { ...claim }, replay: false, ...(key ? { requestId: object(request).requestId as string } : {}) };
  }
  return { observe, claims };
}
