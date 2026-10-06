import { createGoalSession, type GoalSessionOptions, type GoalSessionSnapshot, type GoalCommandOutcome } from '@flow/interaction/goal';
import { goalHelp, parseGoalCommand, parseGoalLine } from './commands.js';
export interface GoalTerminalSnapshot {
  goal: GoalSessionSnapshot; draft: string; notice: string; closed: boolean;
  panel: 'plan' | 'state' | 'history' | 'body' | 'help'; page: number;
}
export interface GoalTerminalResult { ok: boolean; code: string; message: string; outcome?: GoalCommandOutcome }

/** Presentation state only. The public session owns reads, durable intent, CAS and ACK recovery. */
export function createGoalTerminal(options: GoalSessionOptions) {
  const session = createGoalSession(options), listeners = new Set<() => void>();
  let state: GoalTerminalSnapshot = { goal: session.snapshot(), draft: '', notice: '/help lists explicit goal commands.', closed: false, panel: 'plan', page: 1 };
  const publish = (next: Partial<GoalTerminalSnapshot>) => { state = { ...state, ...next }; for (const listener of listeners) { try { listener(); } catch { /* Presentation cannot break the shared session or cleanup. */ } } };
  const unsubscribe = session.subscribe(goal => publish({ goal }));
  const result = (ok: boolean, code: string, message: string, outcome?: GoalCommandOutcome): GoalTerminalResult => { publish({ notice: message }); return { ok, code, message, ...(outcome ? { outcome } : {}) }; };
  const finish = (outcome: GoalCommandOutcome) => result(outcome.state === 'acknowledged', outcome.state.toUpperCase(), outcome.state === 'unknown' ? 'Acknowledgement unknown. Original request saved; use /recover.' : outcome.state === 'rejected' ? `Rejected (${outcome.code}); refreshed plan, no replacement sent.` : 'Center acknowledged the command; refresh /observe for current state.', outcome);
  const show = (panel: GoalTerminalSnapshot['panel']) => publish({ panel, page: 1 });
  function observed(nodeId: string) { const node = state.goal.state?.nodes.find(n => n.nodeId === nodeId); if (!node) throw Error('Observe node first'); return node; }
  let disposing: Promise<void> | undefined;
  function dispose() { return disposing ??= (async () => { publish({ closed: true }); await session.dispose(); unsubscribe(); listeners.clear(); })(); }
  async function execute(value: unknown): Promise<GoalTerminalResult> {
    if (state.closed) return { ok: false, code: 'CLOSED', message: 'Goal observation closed.' };
    try {
      const c = parseGoalCommand(value);
      switch (c.type) {
        case 'help': show('help'); return result(true, 'HELP', goalHelp);
        case 'draft': publish({ draft: c.text }); return result(true, 'DRAFT', 'Local draft only — no task or command sent.');
        case 'page': publish({ page: c.number }); return result(true, 'PAGE', 'Display page selected; no network request.');
        case 'quit': await dispose(); return result(true, 'QUIT', 'Observation closed. Center work continues.');
        case 'plan': await session.plan(); show('plan'); break;
        case 'plan-next': { const after = state.goal.plan?.nextCursor; if (!after) throw Error('No next plan page'); await session.plan({ after }); show('plan'); break; }
        case 'observe': { const ids = c.nodeIds ?? state.goal.plan?.nodes.slice(0, 50).map(n => n.id) ?? []; await session.observe(ids); show('state'); break; }
        case 'history': await session.history(); show('history'); break;
        case 'history-next': { const after = state.goal.history?.nextCursor; if (!after) throw Error('No next history page'); await session.history({ after }); show('history'); break; }
        case 'goal': await session.read({ kind: 'goal' }); show('body'); break;
        case 'input': await session.read({ kind: 'input', nodeId: c.nodeId, version: c.version }); show('body'); break;
        case 'explain': await session.read({ kind: 'explanation', version: c.version }); show('body'); break;
        case 'artifact': { const node = observed(c.nodeId), binding = c.source === 'accepted' ? node.accepted : node.execution?.artifact; if (!binding) throw Error('No observed artifact'); await session.read({ kind: 'artifact', binding }); show('body'); break; }
        case 'decision': { const ref = observed(c.nodeId).execution?.pendingDecision; if (!ref) throw Error('No observed pending decision'); await session.read({ kind: 'decision', nodeId: ref.nodeId, taskId: ref.taskId, decisionId: ref.decisionId }); show('body'); break; }
        case 'decide': { const ref = observed(c.nodeId).execution?.pendingDecision; if (!ref) throw Error('No observed pending decision'); return finish(await session.command({ kind: 'decision', nodeId: c.nodeId, taskId: ref.taskId, input: { decisionId: ref.decisionId, answer: c.answer } })); }
        case 'cancel': { const taskId = observed(c.nodeId).execution?.task.id; if (!taskId) throw Error('No observed execution'); return finish(await session.command({ kind: 'cancel', nodeId: c.nodeId, taskId })); }
        case 'command': return finish(await session.command(c.command));
        case 'recover': return finish(await session.recover());
      }
      return result(true, 'OBSERVED', 'Recorded center state; bodies require explicit expansion.');
    } catch { return result(false, 'GOAL_COMMAND_FAILED', 'Command/read unavailable. Check /help, current /plan and /observe; unresolved receipts require /recover.'); }
  }
  return {
    initialize: session.initialize, execute, dispose,
    async input(text: string) { try { return await execute(parseGoalLine(text)); } catch { return result(false, 'INVALID_COMMAND', 'Invalid goal command. See /help.'); } },
    setDraft(text: string) { if (!state.closed && Buffer.byteLength(text) <= 64 * 1024) publish({ draft: text }); },
    snapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}
export type GoalTerminal = ReturnType<typeof createGoalTerminal>;

/** Bounded terminal pages; full bodies exist only after an explicit public read. */
export function goalDisplay(state: GoalTerminalSnapshot, size = 1600) {
  const goal = state.goal;
  let text: string;
  switch (state.panel) {
    case 'help': text = goalHelp; break;
    case 'plan': text = goal.plan ? `Plan revision ${goal.plan.projectRevision} · ${goal.plan.nodes.length}/${goal.plan.totalNodes} nodes\n` + goal.plan.nodes.map(n => `${n.id} · ${n.title} · input ${n.inputRef?.version ?? 'undefined'} · depends ${n.dependsOn.join(', ') || 'none'}`).join('\n') + (goal.plan.nextCursor ? '\nMore: /plan next' : '') : 'Plan not read'; break;
    case 'state': text = goal.state?.nodes.map(n => `${n.nodeId} · ${n.execution?.task.status ?? 'not executed'} · ${n.reason}\nverification ${n.execution?.task.verificationStatus ?? 'unknown'} · accepted ${n.deliveryCurrent}\ndecision ${n.execution?.pendingDecision?.decisionId ?? 'none'} · artifact ${n.execution?.artifact?.artifactId ?? 'none'}`).join('\n') ?? 'Use /observe to refresh'; break;
    case 'history': text = goal.history ? `Historical references through ${goal.history.throughVersion}; not proof of current validity\n` + goal.history.items.map(i => `${i.reference.version}. ${i.kind} · ${JSON.stringify(i.source)}`).join('\n') + (goal.history.nextCursor ? '\nMore: /history next' : '') : 'Use /history'; break;
    case 'body': text = 'Explicit recorded body (cached); refresh /plan and /observe for current validity.\n' + JSON.stringify(goal.body, null, 2); break;
  }
  const points = Array.from(text), pages = Math.max(1, Math.ceil(points.length / size)), page = Math.min(state.page, pages);
  return { text: points.slice((page - 1) * size, page * size).join(''), page, pages };
}
