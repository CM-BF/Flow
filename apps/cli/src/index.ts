import { pluginRuntimeCommandSchema, pluginToolTaskRequestSchema, PLUGIN_RUNTIME_LIMITS } from '../../../packages/contracts/src/plugin-runtime.js';
import { goalProgressionAuthorizationSchema, goalProgressionRevocationSchema, GOAL_PROGRESSION_MAX_BYTES } from '@flow/contracts';
import { goalPlanConfirmationSchema, GOAL_PLAN_CONFIRMATION_MAX_BYTES } from '@flow/contracts';
import { packageFetchRequestSchema, packageFetchCommandSchema, PACKAGE_FETCH_LIMITS } from '@flow/contracts';
import { pluginInstallRequestSchema, pluginInstallCommandSchema, PLUGIN_INSTALL_LIMITS } from '@flow/contracts';
import { knowledgeCreateSchema, knowledgePublishSchema, knowledgeResolveSchema, KNOWLEDGE_LIMITS, pluginRegistrationSchema, pluginCommandSchema, MAX_PLUGIN_REQUEST_BYTES } from '@flow/contracts';
import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { JsonInputError, readJsonInput } from './json-input.js';
import { FlowClient, FlowApiError, UnknownConversationAcknowledgementError, UnknownPluginAcknowledgementError } from '@flow/client';
import { conversationTurnSchema, conversationQueueEnqueueSchema } from '@flow/contracts';
import { watchTask, taskLine } from './watch.js';
import { taskSubmissionSchema, decisionSchema, registerRunnerSchema, reconciliationObservationSchema, reconciliationResolutionSchema, reconciliationRetrySchema, projectCreationSchema, projectCommandSchema, goalCreationSchema, goalCommandSchema, goalNativeExecutionSchema, type TaskSubmission } from '@flow/contracts';

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
  project: { type: 'string' }, node: { type: 'string' }, version: { type: 'string' }, revision: { type: 'string' }, before: { type: 'string' }, limit: { type: 'string' }, input: { type: 'string' },
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
    if (error instanceof UnknownPluginAcknowledgementError) {
      io.err(error.request.key === undefined
        ? 'The plugin response could not be verified. No state was inferred from it.'
        : 'Plugin command outcome is unknown. Keep the original --key and unchanged input file; recover explicitly with that same request.');
      return 4;
    }
    if (error instanceof UnknownConversationAcknowledgementError) {
      io.err('Conversation acceptance is unknown. Keep the original --key and unchanged input file; recover explicitly with that same request.');
      return 4;
    }
    io.err(error instanceof Error ? error.message : 'Command failed.');
    if (error instanceof FlowApiError) return error.status === 409 ? 3 : 4;
    if (error instanceof UsageError || error instanceof JsonInputError || (error instanceof Error && error.name === 'ZodError') || (typeof error === 'object' && error && 'code' in error && String(error.code).startsWith('ERR_PARSE_ARGS'))) return 2;
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
    case 'usage': { print(await client.taskUsage(required(id, 'task ID'), context.signal)); return 0; }
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
    case 'knowledge': return knowledgeCommand(context);
    case 'conversation': return conversationCommand(context);
    case 'plugin': return pluginCommand(context);
    case 'goal': return goalCommand(context);
    case 'project': return projectCommand(context);
    case 'runner': return runnerCommand(context);
    case 'reconcile': return reconciliationCommand(context);
    default: throw new UsageError(`Unknown command: ${command}. Use --help.`);
  }
}


async function conversationCommand({ client, values, positionals, io, signal }: CommandContext): Promise<number> {
  const action = positionals[1];
  if (action === 'profiles') {
    if (positionals.length !== 2) throw new UsageError('Use conversation profiles [--after UUID] [--limit N].');
    io.out(JSON.stringify(await client.claudeMessageSettingsProfiles({
      ...(values.after !== undefined ? { after: values.after } : {}),
      ...(values.limit !== undefined ? { limit: positiveNumber(values.limit, 'limit') } : {}),
    }, signal)));
    return 0;
  }
  if (!['send', 'enqueue'].includes(action ?? '') || positionals.length !== 3) throw new UsageError('Use conversation profiles|send CONVERSATION_ID|enqueue CONVERSATION_ID.');
  const id = required(positionals[2], 'conversation ID');
  const key = required(values.key, '--key (stable command identifier)');
  const input = await readJsonInput(required(values.input, '--input JSON-file'), 131_072);
  if (action === 'enqueue') io.out(JSON.stringify(await client.enqueueConversationTurn(id, conversationQueueEnqueueSchema.parse(input), key, signal)));
  else {
    const parsed = conversationTurnSchema.parse(input);
    if (parsed.mode !== 'follow-up') throw new UsageError('conversation send requires mode follow-up. Use conversation enqueue for queued input.');
    io.out(JSON.stringify(await client.submitConversationTurn(id, parsed, key, signal)));
  }
  return 0;
}

async function knowledgeCommand({ client, values, positionals, io, signal }: CommandContext): Promise<number> {
  const projectId = required(values.project, '--project');
  const sourceId = () => required(positionals[2], 'source ID');
  let result: unknown;
  switch (positionals[1]) {
    case 'list': result = await client.knowledgeSources(projectId, { ...(values.after ? { after: values.after } : {}), ...(values.limit ? { limit: positiveNumber(values.limit, 'limit') } : {}) }, signal); break;
    case 'show': result = await client.knowledgeSource(projectId, sourceId(), signal); break;
    case 'version': result = await client.knowledgeVersion(projectId, sourceId(), positiveNumber(required(values.version, '--version'), 'version'), signal); break;
    case 'search': result = await client.searchKnowledge(projectId, { q: required(positionals.slice(2).join(' '), 'query'), ...(values.limit ? { limit: positiveNumber(values.limit, 'limit') } : {}) }, signal); break;
    case 'resolve': {
      const input = knowledgeResolveSchema.parse(await readJsonInput(required(values.input, '--input JSON-file'), 4096));
      result = await client.resolveKnowledge(projectId, input.citation, signal); break;
    }
    case 'create':
    case 'publish': {
      // Raw text may require six JSON bytes per UTF-8 byte; schema enforces the separate raw-text limit.
      const input = await readJsonInput(required(values.input, '--input JSON-file'), KNOWLEDGE_LIMITS.textBytes * 6 + 4096);
      const key = required(values.key, '--key (stable command identifier)');
      result = positionals[1] === 'create'
        ? await client.createKnowledgeSource(projectId, knowledgeCreateSchema.parse(input), key, signal)
        : await client.publishKnowledgeVersion(projectId, sourceId(), knowledgePublishSchema.parse(input), key, signal);
      break;
    }
    default: throw new UsageError('Use knowledge create|list|show|publish|version|search|resolve with --project.');
  }
  io.out(JSON.stringify(result));
  return 0;
}

async function pluginCommand({ client, values, positionals, io, signal }: CommandContext): Promise<number> {
  const action = positionals[1];
  const page = { ...(values.after ? { after: values.after } : {}), ...(values.limit ? { limit: positiveNumber(values.limit, 'limit') } : {}) };
  let result: unknown;
  switch (action) {
    case 'removal-references': {
      if (positionals.length !== 4 || values.limit !== undefined || values.before !== undefined) {
        throw new UsageError('Use plugin removal-references PLUGIN MATERIAL_INSTALL_OPERATION [--after CURSOR]; page size is fixed.');
      }
      result = await client.pluginRemovalReferences(required(positionals[2], 'plugin ID'), {
        materialInstallOperationId: required(positionals[3], 'material installation operation ID'),
        ...(values.after === undefined ? {} : { cursor: values.after }),
      }, signal);
      break;
    }
    case 'runtime-hosts': {
      if (positionals.length !== 4 || values.limit !== undefined || values.before !== undefined) {
        throw new UsageError('Use plugin runtime-hosts PLUGIN MATERIAL_INSTALL_OPERATION [--after CURSOR]; page size is fixed.');
      }
      result = await client.pluginHostCandidates(required(positionals[2], 'plugin ID'), {
        materialInstallOperationId: required(positionals[3], 'material installation operation ID'),
        ...(values.after === undefined ? {} : { cursor: values.after }),
      }, signal);
      break;
    }
    case 'runtime': result = await client.pluginRuntime(required(positionals[2], 'plugin ID'), signal); break;
    case 'binding': result = await client.pluginToolBinding(required(positionals[2], 'task ID'), signal); break;
    case 'runtime-change':
    case 'tool-task': {
      const key = required(values.key, '--key (stable command identifier)');
      if (!key.trim() || key.length > 200) throw new UsageError('--key must contain 1–200 characters.');
      const input = await readJsonInput(required(values.input, '--input JSON-file'), PLUGIN_RUNTIME_LIMITS.bodyBytes);
      const id = required(positionals[2], 'plugin ID');
      result = action === 'runtime-change'
        ? await client.commandPluginRuntime(id, pluginRuntimeCommandSchema.parse(input), key, signal)
        : await client.admitPluginToolTask(id, pluginToolTaskRequestSchema.parse(input), key, signal);
      break;
    }
    case 'installs': result = await client.pluginMaterialInstalls(required(positionals[2], 'plugin ID'), page, signal); break;
    case 'install-show': result = await client.pluginMaterialInstall(required(positionals[2], 'material installation ID'), signal); break;
    case 'install-history': result = await client.pluginMaterialInstallHistory(required(positionals[2], 'material installation ID'), page, signal); break;
    case 'install':
    case 'install-change': {
      const input = await readJsonInput(required(values.input, '--input JSON-file'), PLUGIN_INSTALL_LIMITS.bodyBytes);
      const key = required(values.key, '--key (stable command identifier)');
      result = action === 'install'
        ? await client.installPluginVersion(required(positionals[2], 'plugin ID'), required(positionals[3], 'version ID'), pluginInstallRequestSchema.parse(input), key, signal)
        : await client.commandPluginMaterialInstall(required(positionals[2], 'material installation ID'), pluginInstallCommandSchema.parse(input), key, signal);
      break;
    }
    case 'fetches': result = await client.pluginPackageFetches(required(positionals[2], 'plugin ID'), page, signal); break;
    case 'fetch-show': result = await client.packageFetch(required(positionals[2], 'fetch operation ID'), signal); break;
    case 'fetch-history': result = await client.packageFetchHistory(required(positionals[2], 'fetch operation ID'), page, signal); break;
    case 'fetch':
    case 'fetch-change': {
      const input = await readJsonInput(required(values.input, '--input JSON-file'), PACKAGE_FETCH_LIMITS.bodyBytes);
      const key = required(values.key, '--key (stable command identifier)');
      result = action === 'fetch'
        ? await client.fetchPluginPackage(required(positionals[2], 'plugin ID'), required(positionals[3], 'version ID'), packageFetchRequestSchema.parse(input), key, signal)
        : await client.commandPackageFetch(required(positionals[2], 'fetch operation ID'), packageFetchCommandSchema.parse(input), key, signal);
      break;
    }
    case 'list': result = await client.plugins({ ...page, ...(values.project ? { projectId: values.project } : {}) }, signal); break;
    case 'show': result = await client.plugin(required(positionals[2], 'plugin ID'), values.revision ? positiveNumber(values.revision, 'revision') : undefined, signal); break;
    case 'versions': result = await client.pluginVersions(required(positionals[2], 'plugin ID'), page, signal); break;
    case 'history': result = await client.pluginOperations(required(positionals[2], 'plugin ID'), page, signal); break;
    case 'operation': result = await client.pluginOperation(required(positionals[2], 'plugin ID'), required(positionals[3], 'operation ID'), signal); break;
    case 'register':
    case 'change': {
      const input = await readJsonInput(required(values.input, '--input JSON-file'), MAX_PLUGIN_REQUEST_BYTES);
      const key = required(values.key, '--key (stable command identifier)');
      result = action === 'register'
        ? await client.registerPlugin(pluginRegistrationSchema.parse(input), key, signal)
        : await client.commandPlugin(required(positionals[2], 'plugin ID'), pluginCommandSchema.parse(input), key, signal);
      break;
    }
    default: throw new UsageError('Use plugin removal-references|runtime-hosts|runtime|runtime-change|tool-task|binding|register|list|show|versions|history|operation|change|fetch|fetches|fetch-show|fetch-history|fetch-change|install|installs|install-show|install-history|install-change. Static installation does not load or enable a plugin.');
  }
  io.out(JSON.stringify(result));
  return 0;
}

async function goalCommand({ client, values, positionals, io, signal }: CommandContext): Promise<number> {
  const action = positionals[1];
  let result: unknown;
  switch (action) {
    case 'plan': {
      if (positionals[2] !== 'confirm-inputs' || positionals.length !== 4) throw new UsageError('Use goal plan confirm-inputs <proposal-id> --input JSON-file --key stable-key.');
      const key = required(values.key, '--key (stable command identifier)');
      const input = goalPlanConfirmationSchema.parse(await readJsonInput(required(values.input, '--input JSON-file'), GOAL_PLAN_CONFIRMATION_MAX_BYTES));
      result = await client.confirmGoalPlan(required(positionals[3], 'proposal ID'), input, key, signal);
      break;
    }
    case 'progression': result = await client.goalProgression(required(positionals[2], 'goal ID'), required(positionals[3], 'progression ID'), signal); break;
    case 'authorize-progress':
    case 'revoke-progress': {
      const goalId = required(positionals[2], 'goal ID');
      const key = required(values.key, '--key (stable command identifier)');
      const input = await readJsonInput(required(values.input, '--input JSON-file'), GOAL_PROGRESSION_MAX_BYTES);
      result = action === 'authorize-progress'
        ? await client.authorizeGoalProgression(goalId, goalProgressionAuthorizationSchema.parse(input), key, signal)
        : await client.revokeGoalProgression(goalId, required(positionals[3], 'progression ID'), goalProgressionRevocationSchema.parse(input), key, signal);
      break;
    }
    case 'execute-native': {
      const goalId = required(positionals[2], 'goal ID');
      const key = required(values.key, '--key (stable command identifier)');
      const input = goalNativeExecutionSchema.parse(await readJsonInput(required(values.input, '--input JSON-file'), 131_072));
      result = await client.executeGoalNative(goalId, input, key, signal);
      break;
    }
    case 'show': result = await client.readGoal(required(positionals[2], 'goal ID'), signal); break;
    case 'input': result = await client.readGoalInput(required(positionals[2], 'goal ID'), required(values.node, '--node'), values.version ? positiveNumber(values.version, 'version') : undefined, signal); break;
    case 'history': result = await client.goalExecutions(required(positionals[2], 'goal ID'), { nodeId: required(values.node, '--node'), ...(values.after ? { after: values.after } : {}), ...(values.limit ? { limit: positiveNumber(values.limit, 'limit') } : {}) }, signal); break;
    case 'create':
    case 'change': {
      const input = await readJsonInput(required(values.input, '--input JSON-file'), 131_072);
      const key = required(values.key, '--key (stable command identifier)');
      result = action === 'create'
        ? await client.createGoal(goalCreationSchema.parse(input), key, signal)
        : await client.commandGoal(required(positionals[2], 'goal ID'), goalCommandSchema.parse(input), key, signal);
      break;
    }
    default: throw new UsageError('Use goal create|show|input|history|change|execute-native|authorize-progress|progression|revoke-progress|plan confirm-inputs.');
  }
  io.out(JSON.stringify(result));
  return 0;
}

async function projectCommand({ client, values, positionals, io, signal }: CommandContext): Promise<number> {
  const action = positionals[1];
  let result: unknown;
  switch (action) {
    case 'workspaces': result = await client.workspaces(signal); break;
    case 'list': result = await client.projects({ ...(values.after ? { after: values.after } : {}), ...(values.limit ? { limit: positiveNumber(values.limit, 'limit') } : {}) }, signal); break;
    case 'show': result = await client.project(required(positionals[2], 'project ID'), values.revision ? positiveNumber(values.revision, 'revision') : undefined, signal); break;
    case 'create': result = await client.createProject(projectCreationSchema.parse({ title: required(values.title, '--title') }), required(values.key, '--key (stable command identifier)'), signal); break;
    case 'change': {
      const input = await readJsonInput(required(values.input, '--input JSON-file'), 131_072);
      result = await client.changeProject(required(positionals[2], 'project ID'), projectCommandSchema.parse(input), required(values.key, '--key (stable command identifier)'), signal);
      break;
    }
    default: throw new UsageError('Use project workspaces|list|show|create|change.');
  }
  io.out(JSON.stringify(result));
  return 0;
}

async function reconciliationCommand({ client, values, positionals, io }: CommandContext): Promise<number> {
  const action = positionals[1];
  const taskId = required(positionals[2], 'task ID');
  if (action === 'show') { io.out(JSON.stringify(await client.reconciliation(taskId, values.after === undefined ? 0 : cursorNumber(values.after)))); return 0; }
  if (!['observe', 'resolve', 'retry'].includes(action ?? '')) throw new UsageError('Use reconcile show|observe|resolve|retry <task-id>.');
  const input = await readJsonInput(required(values.input, '--input JSON-file'), 131_072);
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

const HELP = `Runtime state: plugin runtime PLUGIN; plugin binding TASK.
Removal references: plugin removal-references PLUGIN MATERIAL_INSTALL_OPERATION [--after CURSOR]. One registration-only page; follow nextCursor explicitly even after an empty page. Pages are independent observations: hostRelease is unknown, physicalRemoval is not-authorized. No other registration coverage or deletion permission is inferred.
Host candidates: plugin runtime-hosts PLUGIN MATERIAL_INSTALL_OPERATION [--after CURSOR]. One advisory page; follow nextCursor explicitly, even after an empty page. Candidates do not prove online, loaded or callable.
Runtime command: plugin runtime-change PLUGIN --input FILE --key KEY; plugin tool-task PLUGIN --input FILE --key KEY.
Runtime input files are bounded to 32 KiB encoded JSON. Enable does not prove loaded/callable; an unknown ACK requires the original route/key/input, never a new key.
Static material: plugin install PLUGIN VERSION --input FILE --key KEY; plugin installs PLUGIN; plugin install-show OP; plugin install-history OP; plugin install-change OP --input FILE --key KEY.
Package fetch: plugin fetch PLUGIN VERSION --input FILE --key KEY; plugin fetches PLUGIN; plugin fetch-show OP; plugin fetch-history OP; plugin fetch-change OP --input FILE --key KEY.
Flow — durable work, from your terminal

Commands:
  conversation profiles [--after UUID] [--limit number] [--json]
  conversation send <conversation-id> --input JSON-file --key stable-key [--json]
  conversation enqueue <conversation-id> --input JSON-file --key stable-key [--json]
  submit "prompt" [--title title] [--harness fixture|claude|a2a] [--key key]
  list
  workspace [--after cursor | --before cursor] [--limit count]
  show <task-id>
  usage <task-id>  # source/cache/coverage readout; SDK estimate is not billing
  watch <task-id> [--timeout milliseconds]
  decision <task-id> approve|reject --decision <decision-id>
  cancel <task-id>
  knowledge create --project project-id --input JSON-file --key stable-key
  knowledge list --project project-id [--after source-id] [--limit count]
  knowledge show <source-id> --project project-id
  knowledge publish <source-id> --project project-id --input JSON-file --key stable-key
  knowledge version <source-id> --project project-id --version number
  knowledge search "query" --project project-id [--limit count]
  knowledge resolve --project project-id --input citation-wrapper-JSON-file
  plugin register --input JSON-file --key stable-key
  plugin list [--project project-id] [--after cursor] [--limit count]
  plugin show <plugin-id> [--revision number]
  plugin versions|history <plugin-id> [--after cursor] [--limit count]
  plugin operation <plugin-id> <operation-id>
  plugin change <plugin-id> --input JSON-file --key stable-key
  goal create --input JSON-file --key stable-key
  goal show <goal-id>
  goal input <goal-id> --node node-id [--version number]
  goal history <goal-id> --node node-id [--after execution-id] [--limit number]
  goal change <goal-id> --input JSON-file --key stable-key
  goal execute-native <goal-id> --input JSON-file --key stable-key
  goal authorize-progress <goal-id> --input JSON-file --key stable-key
  goal progression <goal-id> <progression-id>
  goal revoke-progress <goal-id> <progression-id> --input JSON-file --key stable-key
  goal plan confirm-inputs <proposal-id> --input JSON-file --key stable-key
  project workspaces|list
  project create --title title --key stable-key
  project show <project-id> [--revision number]
  project change <project-id> --input JSON-file --key stable-key
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
Plugin commands record declarations only; packages remain unavailable until verified and loaded.
Leaving watch only stops observation. Use cancel to request execution to stop.`;
