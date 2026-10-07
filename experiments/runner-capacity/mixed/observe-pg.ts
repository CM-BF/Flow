/** Process-local observation only. Never retains SQL text, parameters, URLs, or errors. */
type Callable = (this: unknown, ...args: unknown[]) => unknown;
type Shape = Record<string, unknown>;
export interface PgObservation {
  kind: 'pool-acquisition' | 'sql' | 'transaction'; poolId: number; poolRole: string;
  backendPid: number | null; startedMs: number; elapsedMs: number; outcome: 'ok' | 'error' | 'throw';
  category?: string; total: number; idle: number; waiting: number;
}
function number(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? value : 0; }
function category(value: unknown): string {
  const text = typeof value === 'string' ? value : typeof (value as Shape | null)?.text === 'string' ? (value as Shape).text as string : '';
  const sql = text.trim().replace(/\s+/g, ' ').toUpperCase();
  if (/^BEGIN(?: |$)/.test(sql)) return 'begin';
  if (sql === 'COMMIT') return 'commit';
  if (sql === 'ROLLBACK') return 'rollback';
  if (sql === 'SELECT * FROM FLOW.RUNNERS WHERE ID=$1 FOR UPDATE') return 'runner-row';
  if (sql === 'SELECT ID,REVOKED FROM FLOW.RUNNERS WHERE ID=$1 FOR SHARE') return 'runner-row-share';
  return 'other';
}
export function observePg(poolPrototype: object, report: (event: PgObservation) => void, now = performance.now.bind(performance), onClient: (client: unknown) => void = () => {}, trackBoundary = false) {
  const prototype = poolPrototype as Shape;
  const original = prototype.connect as Callable;
  if (typeof original !== 'function') throw new Error('pool_connect_not_available');
  const pools = new WeakMap<object, number>();
  const clients = new Map<object, { query: Callable; transactionStart?: number }>();
  let nextId = 1; let dropped = 0;
  let acquisitionsStarted = 0, acquisitionsSettled = 0, queriesStarted = 0, queriesSettled = 0;
  function emit(pool: Shape, client: Shape | undefined, kind: PgObservation['kind'], startedMs: number, outcome: PgObservation['outcome'], queryCategory?: string) {
    try {
      let poolId = pools.get(pool); if (!poolId) { poolId = nextId++; pools.set(pool, poolId); }
      const options = pool.options as Shape | undefined;
      const poolRole = options?.max === 8 && options?.statement_timeout === 10_000 ? 'center' : options?.max === 3 ? 'scheduler-candidate' : 'unknown';
      report({ kind, poolId, poolRole, backendPid: typeof client?.processID === 'number' ? client.processID : null,
        startedMs, elapsedMs: now() - startedMs, outcome, ...(queryCategory ? { category: queryCategory } : {}),
        total: number(pool.totalCount), idle: number(pool.idleCount), waiting: number(pool.waitingCount) });
    } catch { dropped++; } // Measurement cannot change database behavior.
  }
  function decorate(client: Shape, pool: Shape) {
    if (clients.has(client)) return;
    const state = { query: client.query as Callable, transactionStart: undefined as number | undefined };
    if (typeof state.query !== 'function') return;
    clients.set(client, state);
    client.query = function(this: unknown, ...args: unknown[]) {
      if (trackBoundary) queriesStarted++;
      const started = now(); const queryCategory = category(args[0]);
      if (queryCategory === 'begin') state.transactionStart = started;
      return observeCall(state.query, this, args, outcome => {
        if (trackBoundary) queriesSettled++;
        emit(pool, client, 'sql', started, outcome, queryCategory);
        if (queryCategory === 'commit' || queryCategory === 'rollback' || queryCategory === 'begin' && outcome !== 'ok') {
          if (state.transactionStart !== undefined) emit(pool, client, 'transaction', state.transactionStart, outcome, queryCategory);
          state.transactionStart = undefined;
        }
      });
    };
  }
  prototype.connect = function(this: unknown, ...args: unknown[]) {
    const pool = this as Shape; const started = now();
    if (trackBoundary) acquisitionsStarted++;
    return observeCall(original, this, args, (outcome, client) => {
      if (trackBoundary) acquisitionsSettled++;
      if (outcome === 'ok' && client && typeof client === 'object') { try { onClient(client); } catch { dropped++; } decorate(client as Shape, pool); }
      if (outcome !== 'ok') { try { onClient(undefined); } catch { dropped++; } }
      emit(pool, client as Shape | undefined, 'pool-acquisition', started, outcome);
    });
  };
  return {
    boundary() { return { known: trackBoundary && dropped === 0, acquisitionsStarted, acquisitionsSettled, acquisitionsInFlight: acquisitionsStarted - acquisitionsSettled,
      queriesStarted, queriesSettled, queriesInFlight: queriesStarted - queriesSettled, openTransactions: [...clients.values()].filter(value => value.transactionStart !== undefined).length,
      basis: 'observed calls only; begin-to-end state, not checkout hold or arrival queue' }; },
    get dropped() { return dropped; },
    restore() { prototype.connect = original; for (const [client, state] of clients) (client as Shape).query = state.query; clients.clear(); },
  };
}
function observeCall(original: Callable, receiver: unknown, args: unknown[], observe: (outcome: PgObservation['outcome'], value?: unknown) => void): unknown {
  // Preserve the original result and error object. Callback remains called exactly once by pg.
  let recorded = false;
  const safe = (outcome: PgObservation['outcome'], value?: unknown) => { if (recorded) return; recorded = true; try { observe(outcome, value); } catch { /* Observer only. */ } };
  const last = args.at(-1);
  if (typeof last === 'function') {
    args[args.length - 1] = function(this: unknown, ...values: unknown[]) {
      safe(values[0] ? 'error' : 'ok', values[1]); return Reflect.apply(last, this, values);
    };
  }
  try {
    const result = Reflect.apply(original, receiver, args);
    if (typeof last !== 'function' && result && typeof (result as Promise<unknown>).then === 'function') {
      void (result as Promise<unknown>).then(value => safe('ok', value), () => safe('error'));
    }
    return result;
  } catch (error) { safe('throw'); throw error; }
}
