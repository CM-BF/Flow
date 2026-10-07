import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { AgentCard, Role, TaskState, type SendMessageRequest, type StreamResponse, type Task } from '@a2a-js/sdk';
import { ServerCallContext, type A2ARequestHandler } from '@a2a-js/sdk/server';
import { A2AError, ContentTypeNotSupportedError, PushNotificationNotSupportedError, RequestMalformedError, TaskNotCancelableError, TaskNotFoundError, UnsupportedOperationError } from '@a2a-js/sdk/errors';
import { FlowApiError } from '@flow/client';
import type { TaskSubmission } from '@flow/contracts';
import { createA2AHttpServer } from './a2a-http-server.js';
import { flowStatus, flowStatuses, settled, toA2ATask, summaryToA2ATask, type FlowProtocolPort } from './a2a-mapping.js';

export interface A2ABridgeOptions {
  flow: FlowProtocolPort;
  token: string;
  submission: Omit<TaskSubmission, 'title' | 'prompt'>;
  publicUrl?: string;
  pollMs?: number;
  observationMs?: number;
}

/** Single-owner bridge. The shared secret grants the same scope as the injected Flow client. */
export function createA2ABridge(options: A2ABridgeOptions) {
  if (!options.token) throw new Error('A bridge token is required.');
  const pollMs = options.pollMs ?? 200;
  const observationMs = options.observationMs ?? 30_000;
  if (!Number.isSafeInteger(pollMs) || pollMs < 1 || !Number.isSafeInteger(observationMs) || observationMs < 1) throw new Error('Invalid bridge time limits.');
  let publicAddress: () => string;
  const signalOf = (context: ServerCallContext) => context.state.get('signal') as AbortSignal;
  const card = () => AgentCard.fromJSON({
    name: 'Flow', description: 'Durable Flow tasks, decisions and verified artifacts. One Flow task per context.', version: '0.1.0',
    supportedInterfaces: [{ url: `${publicAddress()}/a2a`, protocolBinding: 'JSONRPC', protocolVersion: '1.0' }],
    capabilities: { streaming: true, pushNotifications: false },
    securitySchemes: { owner: { httpAuthSecurityScheme: { scheme: 'Bearer' } } }, securityRequirements: [{ schemes: { owner: { list: [] } } }],
    defaultInputModes: ['text/plain', 'application/json'], defaultOutputModes: ['text/plain', 'application/json'],
    skills: [{ id: 'flow-task', name: 'Flow task', description: 'Submit work or answer a Flow decision.', tags: ['task'] }],
  });
  const assertContext = (context: ServerCallContext) => { if (context.tenant) throw new RequestMalformedError('Tenants are not configured.'); };
  const assertHistoryLength = (value?: number) => {
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) throw new RequestMalformedError('historyLength must be a nonnegative integer.');
  };
  const key = (context: ServerCallContext) => {
    const value = context.state.get('commandKey');
    if (value !== undefined && (typeof value !== 'string' || !value.length || value.length > 128)) throw new RequestMalformedError('Invalid Idempotency-Key.');
    return typeof value === 'string' ? `a2a:${value}` : `a2a:${randomUUID()}`;
  };
  const show = async (id: string, signal?: AbortSignal) => {
    if (!id || id.length > 128) throw new RequestMalformedError('A valid task ID is required.');
    try { return await options.flow.show(id, signal); }
    catch (error) { if (error instanceof FlowApiError && error.status === 404) throw new TaskNotFoundError(); throw error; }
  };
  const getTask = async (id: string, context: ServerCallContext, historyLength?: number) => {
    assertContext(context);
    assertHistoryLength(historyLength);
    return toA2ATask(options.flow, await show(id, signalOf(context)), { historyLength, signal: signalOf(context) });
  };
  async function accept(params: SendMessageRequest, context: ServerCallContext): Promise<string> {
    assertContext(context);
    assertHistoryLength(params.configuration?.historyLength);
    const modes = params.configuration?.acceptedOutputModes ?? [];
    if (modes.length && !modes.some(mode => ['text/plain', 'application/json'].includes(mode))) throw new ContentTypeNotSupportedError();
    const message = params.message;
    if (!message || !message.messageId || message.messageId.length > 128 || message.role !== Role.ROLE_USER || !message.parts.length) throw new RequestMalformedError('A user message with messageId and parts is required.');
    if (params.configuration?.taskPushNotificationConfig) throw new PushNotificationNotSupportedError();
    if (message.referenceTaskIds.length || message.extensions.length) throw new UnsupportedOperationError('Task references and message extensions are not configured.');
    if (message.contextId && message.contextId !== message.taskId) throw new RequestMalformedError('This bridge uses taskId as contextId; arbitrary context association is unsupported.');
    if (message.taskId) {
      const part = message.parts[0];
      const answer = part?.content?.$case === 'data' ? part.content.value : null;
      if (message.parts.length !== 1 || !answer || typeof answer.decisionId !== 'string' || !['approve', 'reject'].includes(answer.answer)) throw new RequestMalformedError('Existing tasks accept one data part containing decisionId and answer (approve/reject).');
      await options.flow.decide(message.taskId, { decisionId: answer.decisionId, answer: answer.answer }, key(context));
      return message.taskId;
    }
    if (message.parts.some(part => part.content?.$case !== 'text')) throw new RequestMalformedError('New tasks accept text parts only; file and arbitrary data inputs are unsupported.');
    const prompt = message.parts.map(part => part.content?.value).join('\n');
    if (!prompt.trim() || prompt.length > 16_000) throw new RequestMalformedError('Prompt must contain 1–16000 characters.');
    const accepted = await options.flow.submit({ ...options.submission, title: prompt.trim().slice(0, 180), prompt }, key(context));
    return accepted.task.id;
  }
  async function* observe(id: string, context: ServerCallContext, rejectTerminal: boolean, historyLength?: number): AsyncGenerator<StreamResponse> {
    let snapshot = await show(id, signalOf(context));
    if (rejectTerminal && ['succeeded', 'failed', 'cancelled'].includes(snapshot.status)) throw new UnsupportedOperationError('Terminal tasks cannot be subscribed to; use GetTask.');
    let task = await toA2ATask(options.flow, snapshot, { historyLength, signal: signalOf(context) });
    yield { payload: { $case: 'task', value: task } };
    const seen = new Set(task.artifacts.map(item => item.artifactId));
    let revision = snapshot.updatedAt + ':' + snapshot.watermark;
    while (!['succeeded', 'failed', 'cancelled', 'uncertain'].includes(snapshot.status)) {
      await delay(pollMs, undefined, { signal: signalOf(context) });
      snapshot = await show(id, signalOf(context));
      const next = snapshot.updatedAt + ':' + snapshot.watermark;
      if (next === revision) continue;
      revision = next;
      task = await toA2ATask(options.flow, snapshot, { signal: signalOf(context) });
      for (const artifact of task.artifacts) if (!seen.has(artifact.artifactId)) {
        seen.add(artifact.artifactId);
        yield { payload: { $case: 'artifactUpdate', value: { taskId: id, contextId: id, artifact, append: false, lastChunk: true, metadata: undefined } } };
      }
      yield { payload: { $case: 'statusUpdate', value: { taskId: id, contextId: id, status: flowStatus(snapshot), metadata: task.metadata } } };
    }
  }
  const pushUnsupported = async (): Promise<never> => { throw new PushNotificationNotSupportedError(); };
  const handler: A2ARequestHandler = {
    async getAgentCard() { return card(); },
    async getAuthenticatedExtendedAgentCard() { throw new UnsupportedOperationError('Extended cards are not configured.'); },
    async sendMessage(params, context) {
      const id = await accept(params, context);
      const deadline = Date.now() + observationMs;
      let snapshot = await show(id, signalOf(context));
      while (!params.configuration?.returnImmediately && !settled(snapshot.status)) {
        if (Date.now() >= deadline) throw new A2AError({ message: 'Observation deadline reached; task remains accepted. Use GetTask.', metadata: { taskId: id } });
        await delay(pollMs, undefined, { signal: signalOf(context) });
        snapshot = await show(id, signalOf(context));
      }
      return toA2ATask(options.flow, snapshot, { historyLength: params.configuration?.historyLength, signal: signalOf(context) });
    },
    async *sendMessageStream(params, context) { yield* observe(await accept(params, context), context, false, params.configuration?.historyLength); },
    getTask(params, context) { return getTask(params.id, context, params.historyLength); },
    async cancelTask(params, context) {
      assertContext(context);
      const before = await show(params.id, signalOf(context));
      if (['succeeded', 'failed', 'cancelled'].includes(before.status)) throw new TaskNotCancelableError();
      await options.flow.cancel(params.id, key(context));
      return getTask(params.id, context);
    },
    async *resubscribe(params, context) { assertContext(context); yield* observe(params.id, context, true); },
    async listTasks(params, context) {
      assertContext(context);
      assertHistoryLength(params.historyLength);
      const pageSize = params.pageSize ?? 50;
      if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100 || params.status === TaskState.UNRECOGNIZED) throw new RequestMalformedError('Invalid pageSize or task state.');
      const statuses = flowStatuses(params.status);
      if (statuses?.length === 0) return { tasks: [], nextPageToken: '', pageSize, totalSize: 0 };
      const page = await options.flow.queryTasks({ limit: pageSize, ...(statuses ? { statuses } : {}),
        ...(params.pageToken ? { cursor: params.pageToken } : {}), ...(params.contextId ? { contextId: params.contextId } : {}),
        ...(params.statusTimestampAfter ? { updatedAfter: params.statusTimestampAfter } : {}) }, signalOf(context));
      const tasks: Task[] = [];
      let bytes = 0;
      for (const summary of page.tasks) {
        const task = params.includeArtifacts || params.historyLength
          ? await toA2ATask(options.flow, await show(summary.id, signalOf(context)), { historyLength: params.historyLength ?? 0, includeArtifacts: params.includeArtifacts ?? false, signal: signalOf(context) })
          : summaryToA2ATask(summary);
        // Collection membership/order/status come from the center's repeatable-read index.
        task.status = summaryToA2ATask(summary).status;
        bytes += Buffer.byteLength(JSON.stringify(task));
        if (bytes > 3 * 1024 * 1024) throw new A2AError('List response exceeds the byte budget; request fewer tasks.');
        tasks.push(task);
      }
      return { tasks, nextPageToken: page.nextCursor ?? '', pageSize, totalSize: page.totalSize };
    },
    createTaskPushNotificationConfig: pushUnsupported, getTaskPushNotificationConfig: pushUnsupported,
    listTaskPushNotificationConfigs: pushUnsupported, deleteTaskPushNotificationConfig: pushUnsupported,
  };
  return createA2AHttpServer({ token: options.token, publicUrl: options.publicUrl, handler: url => { publicAddress = url; return handler; } });
}
