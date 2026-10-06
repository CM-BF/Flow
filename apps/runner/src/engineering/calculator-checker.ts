import { z } from 'zod';
import { engineeringFileSchema, engineeringPathSchema, engineeringSnapshotJson } from '../../../../packages/contracts/src/engineering.js';
import { digest } from './resources.js';
import { CALCULATOR_SOURCE_MAX_BYTES, CALCULATOR_SOURCE_POLICY, parseCalculatorSource, type ArithmeticExpression } from './calculator-source.js';

const commit = z.string().regex(/^[a-f0-9]{40}$/), hash = z.string().regex(/^[a-f0-9]{64}$/);
const bindingSchema = z.strictObject({ leaseId: z.uuid(), baseCommit: commit, headCommit: commit, snapshotDigest: hash });
/** These facts come from the host's complete snapshot, never a writer's claimed completion. */
export type CalculatorBinding = Readonly<z.infer<typeof bindingSchema>>;
const snapshotSchema = bindingSchema.extend({
  protocol: z.literal('flow.calculator-snapshot.v1'), files: z.array(engineeringFileSchema).length(1),
  contents: z.array(z.strictObject({ path: engineeringPathSchema, content: z.string().max(CALCULATOR_SOURCE_MAX_BYTES) })).length(1),
});
const checker = Object.freeze({ id: 'calculator-arithmetic', version: '1', sourcePolicy: CALCULATOR_SOURCE_POLICY } as const);
type Rejection = 'invalid-input' | 'binding-mismatch' | 'content-set-mismatch' | 'unsupported-files' | 'content-mismatch' | 'invalid-source';
export type CalculatorCheckReport =
  | Readonly<{ protocol: 'flow.calculator-check.v1'; result: 'rejected'; reason: Rejection }>
  | Readonly<{ protocol: 'flow.calculator-check.v1'; result: 'passed' | 'failed'; checker: typeof checker; binding: CalculatorBinding;
    sourceDigest: string; checks: readonly Readonly<{ id: 'sum' | 'difference'; passed: boolean }>[] }>;
const reject = (reason: Rejection): CalculatorCheckReport => Object.freeze({ protocol: 'flow.calculator-check.v1', result: 'rejected', reason });

/** Checks supplied frozen host content only. No filesystem observation, code execution or stop attestation. */
export function checkCalculatorSnapshot(expected: unknown, input: unknown): CalculatorCheckReport {
  if (!input || typeof input !== 'object') return reject('invalid-input');
  const collection = input as Record<string, unknown>;
  if (!Array.isArray(collection.files) || !Array.isArray(collection.contents)) return reject('invalid-input');
  // Reject collection size before Zod would inspect or copy any members.
  if (collection.files.length !== 1) return reject('unsupported-files');
  if (collection.contents.length !== 1) return reject('content-mismatch');
  const bound = bindingSchema.safeParse(expected), parsed = snapshotSchema.safeParse(input);
  if (!bound.success || !parsed.success) return reject('invalid-input');
  const binding = bound.data, snapshot = parsed.data;
  for (const key of ['leaseId', 'baseCommit', 'headCommit', 'snapshotDigest'] as const) {
    if (binding[key] !== snapshot[key]) return reject('binding-mismatch');
  }
  try {
    if (digest(engineeringSnapshotJson(snapshot)) !== binding.snapshotDigest) return reject('content-set-mismatch');
  } catch { return reject('invalid-input'); }
  const file = snapshot.files[0];
  if (snapshot.files.length !== 1 || !file || file.path !== 'calculator.mjs'
    || file.base?.mode !== '100644' || file.index?.mode !== '100644' || file.worktree?.mode !== '100644') return reject('unsupported-files');
  const content = snapshot.contents[0];
  if (snapshot.contents.length !== 1 || !content || content.path !== file.path
    || Buffer.byteLength(content.content) !== file.worktree.bytes || digest(content.content) !== file.worktree.digest) return reject('content-mismatch');
  const program = parseCalculatorSource(content.content);
  if (!program) return reject('invalid-source');
  const checks = Object.freeze([
    Object.freeze({ id: 'sum' as const, passed: arithmetic(program.functions.add, 5, 2) === 7 }),
    Object.freeze({ id: 'difference' as const, passed: arithmetic(program.functions.subtract, 5, 2) === 3 }),
  ]);
  return Object.freeze({ protocol: 'flow.calculator-check.v1', checker, binding: Object.freeze(binding), sourceDigest: file.worktree.digest,
    checks, result: checks.every(check => check.passed) ? 'passed' : 'failed' });
}

function arithmetic(expression: ArithmeticExpression, a: number, b: number): number {
  const left = expression.left === 'a' ? a : b, right = expression.right === 'a' ? a : b;
  switch (expression.operator) {
    case '+': return left + right;
    case '-': return left - right;
    case '*': return left * right;
    case '/': return left / right;
  }
}
