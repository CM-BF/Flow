import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { expect, it } from 'vitest';
import { mapNativeActivity } from '../../../../apps/runner/src/native-activity/index.js';
import type { NativeActivityBodyInput } from '../../../../packages/contracts/src/native-activity-body.js';

// Exercise the actual PG test's private constructor without importing its PG hooks.
const file = readFileSync('apps/server/src/native-activity-body/production.test.ts', 'utf8');
const ast = ts.createSourceFile('production.test.ts', file, ts.ScriptTarget.Latest, true);
const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'material');
if (!declaration) throw new Error('Missing production material constructor.');
const code = ts.transpileModule(declaration.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const material: (content: Buffer, sessionId: string) => NativeActivityBodyInput = runInNewContext(
  code + '\nmaterial;', { Buffer, createHash, randomUUID }, { timeout: 1000 });

it('matches the canonical mapper identity while preserving one sourceMessageId per material', () => {
  const session = randomUUID(), bytes = Buffer.from('public material');
  const first = material(bytes, session), second = material(bytes, session);
  for (const input of [first, second]) {
    const frame = { type: 'assistant', uuid: input.activity.sourceMessageId, session_id: session,
      parent_tool_use_id: null, message: { id: 'fixture-message', content: [{ type: 'tool_use', id: 'tool', name: 'Read', input: { text: 'public material' } }] } } as Parameters<typeof mapNativeActivity>[0];
    expect(input.activity.activityId).toBe(mapNativeActivity(frame, session)[0]!.activityId);
    expect(input.activity.activityId).not.toBe(createHash('sha256').update(session).digest('hex'));
    expect(Buffer.from(input.content).equals(bytes)).toBe(true);
  }
  expect(first.activity.sourceMessageId).not.toBe(second.activity.sourceMessageId);
  expect(first.activity.activityId).not.toBe(second.activity.activityId);
});

it('preserves the primary work error when runner cleanup also rejects', async () => {
  const registration = ast.statements.find(node => ts.isExpressionStatement(node)
    && ts.isCallExpression(node.expression) && node.expression.arguments[0]?.getText(ast).includes('uses real runRunner'));
  if (!registration || !ts.isExpressionStatement(registration) || !ts.isCallExpression(registration.expression)) throw new Error('Missing production case.');
  const callback = registration.expression.arguments[1];
  if (!callback || !ts.isArrowFunction(callback) || !ts.isBlock(callback.body)) throw new Error('Missing production callback.');
  const work = callback.body.statements.find(node => ts.isTryStatement(node) && node.finallyBlock?.getText(ast).includes('stop.abort()'));
  if (!work) throw new Error('Missing work/cleanup boundary.');
  const boundary = ts.transpileModule(`(async()=>{let primary:unknown,failed=false;${work.getText(ast)};if(failed)throw primary;})()`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const primary = new Error('test work failure'), secondary = Object.assign(new Error('test cleanup failure'), { code: 'CLEANUP_TEST' });
  const running = Promise.reject(secondary); void running.catch(() => undefined);
  const fixture = { facts: {} };
  const result = runInNewContext(boundary, { Error, performance, adapterFailure: undefined, runnerFailure: undefined,
    owner: { show: async () => { throw primary; } }, accepted: { task: { id: 'task' } }, delay: async () => {},
    expect, calls: 1, running, stop: new AbortController(), fixture }, { timeout: 1000 });
  await expect(result).rejects.toBe(primary);
  expect(fixture.facts).toEqual({ runnerCleanupError: { name: 'Error', code: 'CLEANUP_TEST' } });
});
