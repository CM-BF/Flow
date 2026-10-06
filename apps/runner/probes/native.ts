/** Manual, explicitly budgeted R02 evidence probe; never part of the test suite. */
import { randomBytes } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { HarnessContext, RunnerEventData } from '@flow/contracts';
import { createClaudeAdapter, type ClaudeQuery } from '../src/claude.js';

const label = process.argv[2];
if (!['first', 'resume', 'control'].includes(label ?? '')) throw new Error('Choose first, resume, or control.');
const reportPath = resolve('docs/evidence/r02/native-results.json');
type Run = { label: string; startedAt: string; invoked: boolean; prompt: string; elapsedMs: number; passed: boolean; errorClass?: string; gateCalls: number; allowedReads: number; deniedTools: number; tools: string[]; events: RunnerEventData[]; result?: { subtype: string; isError: boolean; turns: number; sdkDurationMs: number; totalCostUsd: number } };
type Report = { sdkVersion: string; nodeVersion: string; fixtureDirectory: string; expected: string; limits: { queries: number; maxTurns: number; maxBudgetUsd: number; timeoutMs: number }; runs: Run[] };
let report: Report;
try { report = JSON.parse(await readFile(reportPath, 'utf8')); }
catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || label !== 'first') throw error;
  const fixtureDirectory = await mkdtemp(join(tmpdir(), 'flow-r02-real-'));
  const expected = randomBytes(12).toString('hex');
  await writeFile(join(fixtureDirectory, 'material.txt'), `FLOW_RANDOM_VALUE=${expected}\n`, { mode: 0o600 });
  report = { sdkVersion: '0.3.290', nodeVersion: process.version, fixtureDirectory, expected, limits: { queries: 5, maxTurns: 4, maxBudgetUsd: 1, timeoutMs: 90_000 }, runs: [] };
}
if (report.runs.length >= 5 || report.runs.some(run => run.label === label)) throw new Error('Probe budget or duplicate run refused.');
const firstSession = report.runs[0]?.events.find(event => event.type === 'session');
if (label === 'resume' && firstSession?.type !== 'session') throw new Error('No first native session to resume.');
const prompt = label === 'first'
  ? 'Read the authorized material and reply only with the exact value after FLOW_RANDOM_VALUE=.'
  : 'What is the FLOW_RANDOM_VALUE from the previous turn? Reply only with that value. If it is unavailable, reply UNKNOWN. Do not guess.';
const item: Run = { label: label!, startedAt: new Date().toISOString(), invoked: false, prompt, elapsedMs: 0, passed: false, gateCalls: 0, allowedReads: 0, deniedTools: 0, tools: [], events: [] };
report.runs.push(item);
await writeFile(reportPath, JSON.stringify(report, null, 2));
const workingDirectory = join(report.fixtureDirectory, label!);
await mkdir(workingDirectory, { mode: 0o700 });
const abort = new AbortController();
const context: HarnessContext = {
  task: { title: `R02 real ${label}`, prompt, harness: 'claude', verification: { kind: 'contains', expected: label === 'control' ? 'UNKNOWN' : report.expected }, ...(label === 'resume' && firstSession?.type === 'session' ? { resumeSessionId: firstSession.nativeSessionId } : {}) },
  workingDirectory, signal: abort.signal,
  async assertOwnership() { abort.signal.throwIfAborted(); },
  async waitForDecision() { throw new Error('This probe does not authorize manual tool approval.'); },
  async emit(event) { item.events.push(event); },
};
const observedQuery: ClaudeQuery = input => {
  item.invoked = true;
  for (const matcher of input.options!.hooks!.PreToolUse!) {
    matcher.hooks = matcher.hooks.map(original => async (...args) => {
      item.gateCalls += 1;
      const response = await original(...args);
      if ('hookSpecificOutput' in response && response.hookSpecificOutput?.hookEventName === 'PreToolUse' && response.hookSpecificOutput.permissionDecision === 'allow') item.allowedReads += 1;
      else item.deniedTools += 1;
      return response;
    });
  }
  const stream = query(input);
  return Object.assign((async function* () {
    for await (const event of stream) {
      if (event.type === 'assistant') {
        for (const block of event.message.content) if (block.type === 'tool_use') item.tools.push(block.name);
      }
      if (event.type === 'result') item.result = { subtype: event.subtype, isError: event.is_error, turns: event.num_turns, sdkDurationMs: event.duration_ms, totalCostUsd: event.total_cost_usd };
      yield event;
    }
  })(), { close() { stream.close(); } });
};
const started = performance.now();
try {
  await createClaudeAdapter({ materialFiles: label === 'first' ? [join(report.fixtureDirectory, 'material.txt')] : [], allowRead: label === 'first', query: observedQuery, maxTurns: 4, maxBudgetUsd: 1, timeoutMs: 90_000 }).run(context);
  const artifact = item.events.find(event => event.type === 'artifact');
  item.passed = artifact?.type === 'artifact' && artifact.content.trim() === (label === 'control' ? 'UNKNOWN' : report.expected);
} catch (error) { item.errorClass = error instanceof Error ? error.name : 'UnknownError'; }
finally {
  item.elapsedMs = Math.round(performance.now() - started);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
}
console.log(JSON.stringify({ label, invoked: item.invoked, elapsedMs: item.elapsedMs, passed: item.passed, errorClass: item.errorClass, gateCalls: item.gateCalls, allowedReads: item.allowedReads, tools: item.tools, result: item.result, queryCount: report.runs.filter(run => run.invoked).length }));
