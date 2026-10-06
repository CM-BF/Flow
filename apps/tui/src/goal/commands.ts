import type { GoalSessionCommand } from '@flow/interaction/goal';
export type GoalTerminalCommand =
  | { type: 'help' | 'plan' | 'plan-next' | 'history' | 'history-next' | 'goal' | 'recover' | 'quit' }
  | { type: 'observe'; nodeIds?: string[] }
  | { type: 'input'; nodeId: string; version: number }
  | { type: 'explain'; version: number }
  | { type: 'artifact'; nodeId: string; source?: 'accepted' | 'execution' }
  | { type: 'decision' | 'cancel'; nodeId: string }
  | { type: 'decide'; nodeId: string; answer: 'approve' | 'reject' }
  | { type: 'command'; command: GoalSessionCommand }
  | { type: 'draft'; text: string }
  | { type: 'page'; number: number };
export const goalHelp = `/plan [next] · /observe [node ids] · /history [next]
/goal · /input node version · /explain version · /artifact node [accepted|execution]
/decision node · /decide node approve|reject · /cancel node
/command <GoalSessionCommand JSON> · /recover · /page number · /quit
Ordinary text remains a local draft. Reads/commands are explicit; refresh with /observe.`;
const positive = (value: unknown) => { const n = Number(value); if (!Number.isSafeInteger(n) || n < 1 || n > 2_147_483_647) throw Error('Expected a positive version/page'); return n; };
export function parseGoalLine(text: string): GoalTerminalCommand {
  if (!text.startsWith('/')) return { type: 'draft', text };
  const [name, ...args] = text.trim().split(/\s+/); const exact = (n: number) => { if (args.length !== n) throw Error('Invalid command arguments'); };
  switch (name) {
    case '/help': case '/goal': case '/recover': case '/quit': exact(0); return { type: name.slice(1) as 'help' | 'goal' | 'recover' | 'quit' };
    case '/plan': case '/history': if (args.length > 1 || args.length === 1 && args[0] !== 'next') throw Error('Expected optional next'); return { type: `${name.slice(1)}${args.length ? '-next' : ''}` as 'plan' | 'plan-next' | 'history' | 'history-next' };
    case '/observe': return { type: 'observe', ...(args.length ? { nodeIds: args } : {}) };
    case '/input': exact(2); return { type: 'input', nodeId: args[0]!, version: positive(args[1]) };
    case '/explain': exact(1); return { type: 'explain', version: positive(args[0]) };
    case '/artifact': if (args.length < 1 || args.length > 2 || args[1] && !['accepted', 'execution'].includes(args[1])) throw Error('Invalid artifact source'); return { type: 'artifact', nodeId: args[0]!, source: (args[1] ?? 'execution') as 'accepted' | 'execution' };
    case '/decision': case '/cancel': exact(1); return { type: name.slice(1) as 'decision' | 'cancel', nodeId: args[0]! };
    case '/decide': exact(2); if (args[1] !== 'approve' && args[1] !== 'reject') throw Error('Expected approve or reject'); return { type: 'decide', nodeId: args[0]!, answer: args[1] };
    case '/command': return { type: 'command', command: JSON.parse(text.slice('/command'.length)) as GoalSessionCommand };
    case '/page': exact(1); return { type: 'page', number: positive(args[0]) };
    default: throw Error('Unknown goal command');
  }
}
/** Strict syntax boundary only. Domain validation remains in createGoalSession. */
export function parseGoalCommand(value: unknown): GoalTerminalCommand {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Expected a command object');
  const c = value as Record<string, unknown>;
  const fields: Record<string, string[]> = { help: [], plan: [], 'plan-next': [], history: [], 'history-next': [], goal: [], recover: [], quit: [], observe: ['nodeIds'], input: ['nodeId', 'version'], explain: ['version'], artifact: ['nodeId', 'source'], decision: ['nodeId'], cancel: ['nodeId'], decide: ['nodeId', 'answer'], command: ['command'], draft: ['text'], page: ['number'] };
  if (typeof c.type !== 'string' || !Object.hasOwn(fields, c.type) || Object.keys(c).some(k => k !== 'type' && !fields[c.type as string]!.includes(k))) throw Error('Unknown goal command fields');
  if (fields[c.type]!.includes('nodeId') && (typeof c.nodeId !== 'string' || !c.nodeId || c.nodeId.length > 128)) throw Error('Expected node identity');
  if (c.type === 'input' || c.type === 'explain') { if (typeof c.version !== 'number') throw Error('Expected version number'); positive(c.version); }
  if (c.type === 'page') { if (typeof c.number !== 'number') throw Error('Expected page number'); positive(c.number); }
  if (c.type === 'observe' && c.nodeIds !== undefined && (!Array.isArray(c.nodeIds) || c.nodeIds.length < 1 || c.nodeIds.length > 50 || c.nodeIds.some(id => typeof id !== 'string' || !id || id.length > 128))) throw Error('Expected 1..50 node identities');
  if (c.type === 'artifact' && c.source !== undefined && c.source !== 'execution' && c.source !== 'accepted') throw Error('Unknown artifact source');
  if (c.type === 'decide' && c.answer !== 'approve' && c.answer !== 'reject') throw Error('Unknown decision');
  if (c.type === 'draft' && (typeof c.text !== 'string' || Buffer.byteLength(c.text) > 64 * 1024)) throw Error('Draft exceeds limit');
  if (c.type === 'command' && (!c.command || typeof c.command !== 'object')) throw Error('Expected explicit domain command');
  return structuredClone(c) as GoalTerminalCommand;
}
