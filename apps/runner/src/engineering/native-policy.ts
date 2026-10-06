import { z } from 'zod';
import type { Json } from '../codex/types.js';
import type { CodexExchangeRecipe } from '../native-harness/codex/exchange.js';
import { CodexTurnEvidence, type CodexItemPhase } from '../native-harness/codex/evidence.js';
import { assertOrdinaryItem, denyCodexRequest } from '../native-harness/codex/policy.js';
import { nativeId } from '../native-harness/codex/wire.js';

export const nativeEngineeringModelSchema = z.enum(['gpt-5.6-sol', 'gpt-6-astra']);
export type NativeEngineeringModel = z.infer<typeof nativeEngineeringModelSchema>;
const fileItem = z.strictObject({ type: z.literal('fileChange'), id: nativeId,
  changes: z.array(z.strictObject({ path: z.literal('calculator.mjs'),
    kind: z.strictObject({ type: z.literal('update'), move_path: z.null() }),
    diff: z.string().min(1).max(16_384).refine(text => Buffer.byteLength(text) <= 16_384), })).length(1),
  status: z.enum(['inProgress', 'completed', 'failed', 'declined']), });
const approval = z.strictObject({ threadId: nativeId, turnId: nativeId, itemId: nativeId,
  startedAtMs: z.number().finite().nonnegative(), reason: z.string().max(1024).nullable().optional(), grantRoot: z.null().optional() });

/** This finite recipe observes calculator updates. The authority must separately enforce actual write permissions. */
export function createNativeFileRecipe(model: NativeEngineeringModel, cwd: string, prompt: string): CodexExchangeRecipe {
  const files = new Map<string, { changes: string; approved: boolean; completed: boolean }>();
  const evidence = new CodexTurnEvidence(checkItem);
  let rejected = false;
  function checkItem(raw: unknown, phase: CodexItemPhase) {
    if (!raw || typeof raw !== 'object' || !('type' in raw) || raw.type !== 'fileChange') { assertOrdinaryItem(raw); return; }
    const item = fileItem.parse(raw), changes = JSON.stringify(item.changes), previous = files.get(item.id);
    if (phase === 'started') {
      if (previous || files.size >= 16 || item.status !== 'inProgress') throw Error('File start rejected.');
      files.set(item.id, { changes, approved: false, completed: false }); return;
    }
    if (!previous || previous.changes !== changes || !previous.approved || item.status !== 'completed') throw Error('File evidence rejected.');
    if (phase === 'completed') previous.completed = true;
    else if (phase !== 'terminal' || !previous.completed) throw Error('File terminal rejected.');
  }
  return {
    evidence,
    // Native declarations are defense in depth, not the authority's enforcement or model qualification.
    startThread: { model, cwd, ephemeral: true, approvalPolicy: 'untrusted', sandbox: 'workspace-write' },
    startTurn: threadId => ({ threadId, model, cwd, approvalPolicy: 'untrusted',
      sandboxPolicy: { type: 'workspaceWrite', writableRoots: [cwd], networkAccess: false, excludeTmpdirEnvVar: true, excludeSlashTmp: true },
      input: [{ type: 'text', text: prompt, text_elements: [] }] }),
    readThread(raw) {
      const receipt = z.object({ thread: z.object({ id: nativeId }), model: z.literal(model), approvalPolicy: z.literal('untrusted'),
        sandbox: z.strictObject({ type: z.literal('workspaceWrite'), writableRoots: z.tuple([z.literal(cwd)]), networkAccess: z.literal(false),
          excludeTmpdirEnvVar: z.literal(true), excludeSlashTmp: z.literal(true) }) }).parse(raw);
      return { threadId: receipt.thread.id };
    },
    checkCompletion() {
      if (!files.size || [...files.values()].some(file => !file.completed)) throw Error('File completion is incomplete.');
    },
    respond(method: string, params: Json) {
      if (!rejected && method === 'item/fileChange/requestApproval') {
        const parsed = approval.safeParse(params);
        const item = parsed.success ? files.get(parsed.data.itemId) : undefined;
        if (parsed.success && item && !item.approved && !item.completed && evidence.matches(parsed.data.threadId, parsed.data.turnId)) {
          item.approved = true; return { allowed: true, reply: { result: { decision: 'accept' } } };
        }
      }
      rejected = true; return { allowed: false, reply: denyCodexRequest(method) };
    },
  };
}
