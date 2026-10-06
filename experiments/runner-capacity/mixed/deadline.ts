export type Settlement<T> = { state: 'settled'; value: T } | { state: 'unknown'; reason: 'deadline-before-start' | 'deadline' | 'operation-failed' };
/** Bounds waiting, not the OS operation itself. Unknown must retain resource ownership. */
export async function beforeDeadline<T>(deadline: number, operation: () => Promise<T>, now = performance.now.bind(performance)): Promise<Settlement<T>> {
  const remaining = deadline - now();
  if (remaining <= 0) return { state: 'unknown', reason: 'deadline-before-start' };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const pending = Promise.resolve().then(() => { if (now() >= deadline) throw new Error('deadline-before-operation'); return operation(); }).then<Settlement<T>, Settlement<T>>(
    value => ({ state: 'settled', value }), () => ({ state: 'unknown', reason: 'operation-failed' }));
  const expired = new Promise<Settlement<T>>(resolve => { timer = setTimeout(() => resolve({ state: 'unknown', reason: 'deadline' }), remaining); });
  try { return await Promise.race([pending, expired]); }
  finally { clearTimeout(timer); }
}
