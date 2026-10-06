import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { FlowClient, FlowApiError } from '@flow/client';
import { watchTask, taskLine } from './watch.js';
import { taskSubmissionSchema, decisionSchema, registerRunnerSchema, reconciliationObservationSchema, reconciliationResolutionSchema, reconciliationRetrySchema, type TaskSubmission } from '@flow/contracts';

export interface CliIO { out(text: string): void; err(text: string): void }
const defaultIO: CliIO = { out: text => process.stdout.write(`${text}\n`), err: text => process.stderr.write(`${text}\n`) };
export class UsageError extends Error {}

const options = {
  help: { type: 'boolean', short: 'h' }, json: { type: 'boolean' },
  url: { type: 'string' }, title: { type: 'string' }, prompt: { type: 'string' },
  harness: { type: 'string' }, endpoint: { type: 'string' }, scenario: { type: 'string' }, key: { type: 'string' },
  decision: { type: 'string' }, expect: { type: 'string' }, timeout: { type: 'string' },
  name: { type: 'string' }, capacity: { type: 'string' }, after: { type: 'string' },
  resume: { type: 'string' }, 'delay-ms': { type: 'string' },
  before: { type: 'string' }, limit: { type: 'string' }, input: { type: 'string' },
} as const;
type Flags = ReturnType<typeof parseCliArgs>['values'];
function parseCliArgs(args: string[]) { return parseArgs({ args, options, allowPositionals: true }); }

export async function runCli(args: string[], io: CliIO = defaultIO, env: NodeJS.ProcessEnv = process.env, signal?: AbortSignal): Promise<number> {
  try {
    const { values, positionals } = parseCliArgs(args);
    if (values.help || !positionals.length) { io.out(HELP); return 0; }
    if (!env.FLOW_TOKEN) throw new UsageError('Set FLOW_TOKEN to your owner credential.');
    const client = new FlowClient({ baseUrl: values.url ?? env.FLOW_URL ?? 'http://127.0.0.1:4310', token: env.FLOW_TOKEN });
    return await executeCommand({ client, values, positionals, io, signal });
  } catch (error) {
    io.err(error instanceof Error ? error.message : 'Command failed.');
    if (error instanceof FlowApiError) return error.status === 409 ? 3 : 4;
    if (error instanceof UsageError || (error instanceof Error && error.name === 'ZodError') || (typeof error === 'object' && error && 'code' in error && String(error.code).startsWith('ERR_PARSE_ARGS'))) return 2;
    return 4;
  }
}

interface CommandContext { client: FlowClient; values: Flags; positionals: string[]; io: CliIO; signal?: AbortSignal }
async function executeCommand(context: CommandContext): Promise<number> {
  const { client, values, positionals, io } = context;
  const [command, id, answer] = positionals;
  const print = (value: unknown, text?: string) => io.out(values.json || !text ? JSON.stringify(value) : text);
  const key = values.key ?? randomUUID();
  switch (command) {
    case 'submit': {
      const result = await client.submit(submission(values, positionals.slice(1)), key);
      print(result, `Accepted ${result.task.id} · ${result.task.status}${result.replayed ? ' (replayed)' : ''}`);
      return 0;
    }
    case 'list': {
      const result = await client.list();
      print(result, result.tasks.map(taskLine).join('\n') || 'No tasks yet.');
      return 0;
    }
    case 'workspace': {
      const result = await client.workspace({
        ...(values.after !== undefined ? { after: cursorNumber(values.after) } : {}),
        ...(values.before !== undefined ? { before: positiveNumber(values.before, 'before') } : {}),
        ...(values.limit !== undefined ? { limit: positiveNumber(values.limit, 'limit') } : {}),
      }, context.signal);
      const activity = result.entries.map(item => `${item.task.title}: ${item.entry.kind === 'text' ? item.entry.text : `[${item.entry.reference.title}] ${item.entry.reference.id}`}`).join('\n');
      const attention = result.attention.map(task => `${task.title} (${task.id}): ${task.pendingDecision ? `${task.pendingDecision.prompt} [decision ${task.pendingDecision.id}]` : 'Execution is uncertain; inspect reconciliation before taking further action.'}`).join('\n');
      print(result, `${activity || 'No recorded activity.'}\n${attention ? `\nNeeds your attention:\n${attention}` : '\nNo pending decisions.'}${result.tasksTruncated || result.attentionTruncated ? '\nThe task summary is bounded; use list for remaining tasks.' : ''}${result.projectionPending ? '\nMore saved activity is being projected; refresh to continue.' : ''}`);
      return 0;
    }
    case 'show': {
      const task = await client.show(required(id, 'task ID'));
      print(task, `${taskLine(task)}\n${task.entries.map(entry => entry.kind === 'text' ? entry.text : `[${entry.reference.title}] ${entry.reference.id}`).join('\n')}${task.pendingDecision ? `\nDecision ${task.pendingDecision.id}: ${task.pendingDecision.prompt}` : ''}`);
      return 0;
    }
    case 'watch': return watchTask(client, required(id, 'task ID'), { json: values.json ?? false, signal: context.signal, ...(values.timeout ? { timeoutMs: positiveNumber(values.timeout, 'timeout') } : {}) }, io);
    case 'decision': {
      const result = await client.decide(required(id, 'task ID'), decisionSchema.parse({ decisionId: required(values.decision, '--decision'), answer }), key);
      print(result, taskLine(result));
      return 0;
    }
    case 'cancel': {
      const result = await client.cancel(required(id, 'task ID'), key);
      print(result, taskLine(result));
      return 0;
    }
    case 'protocol': { print(await client.protocolState(required(id, 'task ID'), context.signal)); return 0; }
    case 'detail': {
      const result = await client.detail(required(id, 'reference ID'));
      print(result, `${result.title}\n${result.content}`);
      return 0;
    }
    case 'events': {
      const after = values.after === undefined ? 0 : Number(values.after);
      if (!Number.isSafeInteger(after) || after < 0) throw new UsageError('--after must be a nonnegative safe integer.');
      print(await client.events(required(id, 'task ID'), after));
      return 0;
    }
    case 'runner': return runnerCommand(context);
    case 'reconcile': return reconciliationCommand(context);
    default: throw new UsageError(`Unknown command: ${command}. Use --help.`);
  }
}

async function reconciliationCommand({ client, values, positionals, io }: CommandContext): Promise<number> {
  const action = positionals[1];
  const taskId = required(positionals[2], 'task ID');
  if (action === 'show') { io.out(JSON.stringify(await client.reconciliation(taskId, values.after === undefined ? 0 : cursorNumber(values.after)))); return 0; }
  if (!['observe', 'resolve', 'retry'].includes(action ?? '')) throw new UsageError('Use reconcile show|observe|resolve|retry <task-id>.');
  const raw = await readFile(required(values.input, '--input JSON-file'), 'utf8');
  if (Buffer.byteLength(raw) > 131_072) throw new UsageError('Reconciliation input must not exceed 128 KiB.');
  let input: unknown;
  try { input = JSON.parse(raw); } catch { throw new UsageError('--input must contain valid JSON.'); }
  const key = required(values.key, '--key (stable command identifier)');
  const result = action === 'observe'
    ? await client.recordReconciliation(taskId, reconciliationObservationSchema.parse(input), key)
    : action === 'resolve'
      ? await client.resolveReconciliation(taskId, reconciliationResolutionSchema.parse(input), key)
      : await client.retryReconciledTask(taskId, reconciliationRetrySchema.parse(input), key);
  io.out(JSON.stringify(result));
  return 0;
}

function cursorNumber(value: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new UsageError('Cursor must be a nonnegative safe integer.');
  return number;
}

async function runnerCommand({ client, values, positionals, io }: CommandContext): Promise<number> {
  if (positionals[1] === 'register') {
    const registration = registerRunnerSchema.parse({ name: required(values.name, '--name'), harnesses: [values.harness ?? 'fixture'], capacity: values.capacity ? positiveNumber(values.capacity, 'capacity') : 1 });
    const result = await client.registerRunner(registration);
    io.out(JSON.stringify(result));
    io.err('Save the runner token securely. The center cannot display it again.');
    return 0;
  }
  if (positionals[1] === 'revoke') { io.out(JSON.stringify(await client.revokeRunner(required(positionals[2], 'runner ID')))); return 0; }
  throw new UsageError('Use runner register or runner revoke.');
}

function required(value: string | undefined, name: string): string {
  if (!value) throw new UsageError(`Provide ${name}.`);
  return value;
}

function positiveNumber(value: string, name: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw new UsageError(`${name} must be a positive safe integer.`);
  return number;
}

function submission(values: Flags, words: string[]): TaskSubmission {
  const prompt = values.prompt ?? words.join(' ');
  if (!prompt.trim()) throw new UsageError('Provide a prompt after submit or with --prompt.');
  return taskSubmissionSchema.parse({
    title: values.title ?? prompt.slice(0, 100), prompt, harness: values.harness ?? 'fixture',
    ...(values.scenario ? { fixture: { scenario: values.scenario, ...(values['delay-ms'] ? { delayMs: Number(values['delay-ms']) } : {}) } } : {}),
    ...(values.expect ? { verification: { kind: 'contains', expected: values.expect } } : {}),
    ...(values.endpoint ? { protocol: { endpointRef: values.endpoint } } : {}),
    ...(values.resume ? { resumeSessionId: values.resume } : {}),
  });
}

const HELP = `Flow — durable work, from your terminal

Commands:
  submit "prompt" [--title title] [--harness fixture|claude|a2a] [--key key]
  list
  workspace [--after cursor | --before cursor] [--limit count]
  show <task-id>
  watch <task-id> [--timeout milliseconds]
  decision <task-id> approve|reject --decision <decision-id>
  cancel <task-id>
  protocol <task-id>
  detail <reference-id>
  events <task-id> [--after cursor]
  reconcile show <task-id> [--after audit-cursor]
  reconcile observe|resolve|retry <task-id> --input JSON-file --key stable-key
  runner register --name name [--harness fixture|claude|a2a] [--capacity 1]
  runner revoke <runner-id>

Options: --json emits machine-readable output; --url overrides FLOW_URL.
Submit: --scenario success|decision|failure|verification-failure|slow|large
        --endpoint configured-ref (required for a2a)
        --delay-ms milliseconds --expect text --resume native-session-id
Authentication: FLOW_TOKEN. Center: FLOW_URL (default http://127.0.0.1:4310).
Leaving watch only stops observation. Use cancel to request execution to stop.`;
