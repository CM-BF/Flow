import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import type { AsyncCodexExchangeRecipe } from '../native-harness/codex/exchange.js';
import { CodexTurnEvidence, type CodexItemPhase } from '../native-harness/codex/evidence.js';
import { assertOrdinaryItem, denyCodexRequest } from '../native-harness/codex/policy.js';
import { nativeId } from '../native-harness/codex/wire.js';
import { nativeEngineeringModelSchema, type NativeEngineeringModel } from './native-policy.js';
import { calculatorToolArguments, type TrustedToolWriter, type ToolWriteOutcome } from './native-tool-writer.js';

const TOOL = 'flow_calculator_update';
const request = z.strictObject({ threadId: nativeId, turnId: nativeId, callId: nativeId,
  tool: z.literal(TOOL), namespace: z.null().optional(), arguments: calculatorToolArguments });
const output = z.strictObject({ type: z.literal('inputText'), text: z.string().max(1024) });
const itemSchema = z.strictObject({ type: z.literal('dynamicToolCall'), id: nativeId, tool: z.literal(TOOL),
  namespace: z.null().optional(), arguments: calculatorToolArguments,
  status: z.enum(['inProgress', 'completed', 'failed']),
  contentItems: z.array(output).max(1).nullable().optional(), success: z.boolean().nullable().optional(),
  durationMs: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable().optional() });

/** Experimental stock dynamic-tools protocol. It requires a separately enforced read-only native
 * launch and a trusted file gate; configuration echoes are not observed model identity or grants. */
export function createNativeToolRecipe(options: { model: NativeEngineeringModel; cwd: string; prompt: string;
  writer: TrustedToolWriter }): AsyncCodexExchangeRecipe {
  const model = nativeEngineeringModelSchema.parse(options.model);
  if (!options.cwd.startsWith('/') || Buffer.byteLength(options.cwd) > 4096 || Buffer.byteLength(options.prompt) > 65_536) throw Error('Tool recipe input exceeds bounds.');
  let item: { id: string; args: string; completed: boolean; outcome?: ToolWriteOutcome } | undefined;
  let rejected = false;
  const evidence = new CodexTurnEvidence(checkItem);
  function checkItem(raw: unknown, phase: CodexItemPhase) {
    if (!raw || typeof raw !== 'object' || !('type' in raw) || raw.type !== 'dynamicToolCall') { assertOrdinaryItem(raw); return; }
    const value = itemSchema.parse(raw), args = JSON.stringify(value.arguments);
    if (phase === 'started') {
      if (item || value.status !== 'inProgress' || value.success != null || value.contentItems != null) throw Error('Tool start rejected.');
      item = { id: value.id, args, completed: false }; return;
    }
    if (!item || value.id !== item.id || args !== item.args || item.outcome?.state !== 'written'
      || value.status !== 'completed' || value.success !== true || !isDeepStrictEqual(value.contentItems, content(item.outcome))) throw Error('Tool item differs from host outcome.');
    if (phase === 'completed' && !item.completed) item.completed = true;
    else if (phase !== 'terminal' || !item.completed) throw Error('Tool terminal rejected.');
  }
  return {
    evidence,
    startThread: { model, cwd: options.cwd, ephemeral: true, approvalPolicy: 'never', sandbox: 'read-only',
      dynamicTools: [{ type: 'function', name: TOOL, description: 'Replace the bound calculator contents once using an expected digest.',
        inputSchema: { type: 'object', properties: { expectedSha256: { type: 'string', pattern: '^[a-f0-9]{64}$' },
          contentsBase64: { type: 'string', maxLength: 2732 } }, required: ['expectedSha256', 'contentsBase64'], additionalProperties: false } }] },
    startTurn: threadId => ({ threadId, model, cwd: options.cwd, approvalPolicy: 'never',
      sandboxPolicy: { type: 'readOnly', networkAccess: false },
      input: [{ type: 'text', text: options.prompt, text_elements: [] }] }),
    readThread(raw) {
      const receipt = z.object({ thread: z.object({ id: nativeId }), model: z.literal(model), approvalPolicy: z.literal('never'),
        sandbox: z.strictObject({ type: z.literal('readOnly'), networkAccess: z.literal(false) }) }).parse(raw);
      return { threadId: receipt.thread.id };
    },
    checkCompletion() { if (rejected || !item?.completed || item.outcome?.state !== 'written') throw Error('Tool completion is incomplete.'); },
    async respond(method, params, signal) {
      if (!rejected && !signal.aborted && method === 'item/tool/call') {
        const parsed = request.safeParse(params);
        if (parsed.success && item && !item.completed && item.id === parsed.data.callId
          && item.args === JSON.stringify(parsed.data.arguments) && evidence.matches(parsed.data.threadId, parsed.data.turnId)) {
          options.writer.bindTurn(parsed.data.threadId, parsed.data.turnId);
          const seal = () => options.writer.seal();
          signal.addEventListener('abort', seal, { once: true });
          if (signal.aborted) seal();
          let outcome: ToolWriteOutcome;
          try { outcome = await options.writer.invoke(parsed.data, signal); }
          finally { signal.removeEventListener('abort', seal); }
          item.outcome = outcome;
          if (outcome.state === 'written' && !signal.aborted) return { allowed: true, reply: { result: { contentItems: content(outcome), success: true } } };
        }
      }
      rejected = true;
      options.writer.seal();
      return { allowed: false, reply: denyCodexRequest(method) };
    },
  };
}
function content(outcome: Extract<ToolWriteOutcome, { state: 'written' }>) {
  return [{ type: 'inputText' as const, text: JSON.stringify({ protocol: 'flow.calculator-tool-write.v1', ...outcome }) }];
}
