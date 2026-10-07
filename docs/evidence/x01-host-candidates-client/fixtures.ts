export const id = '11111111-1111-4111-8111-111111111111';
export const material = '22222222-2222-4222-8222-222222222222';
export const runner = (n: number) => `33333333-3333-4333-8333-${String(n).padStart(12, '0')}`;
export const query = { materialInstallOperationId: material };
export function candidate(n = 1) { return { protocol: 'flow.plugin-runtime.v1' as const, runnerId: runner(n), runnerName: 'Shared runner name', storeId: 'store-a', hostApiMajor: 1 as const, selectable: true, reason: 'compatible' as string, online: 'unknown' as const, loaded: 'unknown' as const, callable: 'unknown' as const }; }
export function page() { return { protocol: 'flow.plugin-runtime.v1', registrationId: id, currentRevision: 3, versionId: '44444444-4444-4444-8444-444444444444', materialInstallOperationId: material, candidates: [candidate()], nextCursor: null as string | null }; }
export function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }); }
