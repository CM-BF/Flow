import { CancelTaskRequest, GetTaskRequest, TaskState, SubscribeToTaskRequest, type AgentCard, type ListTasksRequest, type SendMessageRequest, type StreamResponse, type Task } from '@a2a-js/sdk';
import { ClientFactory, DefaultAgentCardResolver, JsonRpcTransportFactory, type Client, type RequestOptions } from '@a2a-js/sdk/client';
import { A2AError, UnsupportedOperationError } from '@a2a-js/sdk/errors';
import { guardedFetch, remoteUrl, RemoteOutcomeUncertainError, type RemoteOptions } from './http-policy.js';

export async function connectA2A(options: RemoteOptions): Promise<A2APeer> {
  const url = remoteUrl(options);
  const fetchImpl = guardedFetch(options);
  const cardResolver = new DefaultAgentCardResolver({ fetchImpl });
  const card = await cardResolver.resolve(url.href);
  const interfaces = card.supportedInterfaces.filter(item => item.protocolVersion === '1.0' && item.protocolBinding === 'JSONRPC');
  if (!interfaces.length) throw new Error('Peer does not advertise A2A 1.0 JSONRPC.');
  for (const item of interfaces) {
    if (new URL(item.url).origin !== url.origin) throw new Error('Agent card endpoint origin is not authorized.');
  }
  const selected = { ...card, supportedInterfaces: interfaces };
  const sdk = await new ClientFactory({ transports: [new JsonRpcTransportFactory({ fetchImpl })], cardResolver, clientConfig: { polling: true } }).createFromAgentCard(selected);
  return new A2APeer(sdk, selected);
}

export class A2APeer {
  constructor(private readonly sdk: Client, public readonly card: AgentCard) {}

  async send(request: SendMessageRequest, options?: RequestOptions) {
    try { return await this.sdk.sendMessage(request, options); }
    catch (error) { if (error instanceof A2AError) throw error; throw new RemoteOutcomeUncertainError('SendMessage', request.message?.taskId || undefined, error); }
  }

  snapshot(selection: string | Pick<GetTaskRequest, 'id' | 'historyLength'>, options?: RequestOptions): Promise<Task> {
    const request = typeof selection === 'string' ? { id: selection } : selection;
    return this.sdk.getTask(GetTaskRequest.fromJSON(request), options);
  }

  list(request: ListTasksRequest, options?: RequestOptions) { return this.sdk.listTasks(request, options); }

  async cancel(id: string, options?: RequestOptions): Promise<Task> {
    try { return await this.sdk.cancelTask(CancelTaskRequest.fromJSON({ id }), options); }
    catch (error) { if (error instanceof A2AError) throw error; throw new RemoteOutcomeUncertainError('CancelTask', id, error); }
  }

  async *sendStream(request: SendMessageRequest, options?: RequestOptions): AsyncGenerator<StreamResponse> {
    if (!this.card.capabilities?.streaming) throw new Error('Peer does not advertise streaming.');
    let taskId = request.message?.taskId || undefined;
    try {
      for await (const event of this.sdk.sendMessageStream(request, options)) {
        if (event.payload?.$case === 'task') taskId = event.payload.value.id;
        yield event;
      }
    } catch (error) { if (error instanceof A2AError) throw error; throw new RemoteOutcomeUncertainError('SendStreamingMessage', taskId, error); }
  }

  /** Reconcile first: A2A subscriptions promise future updates, not lossless replay. */
  async *observe(id: string, options?: RequestOptions): AsyncGenerator<StreamResponse> {
    const snapshot = await this.snapshot(id, options);
    yield { payload: { $case: 'task', value: snapshot } };
    if (terminal(snapshot) || !this.card.capabilities?.streaming) return;
    try { yield* this.sdk.resubscribeTask(SubscribeToTaskRequest.fromJSON({ id }), options); }
    catch (error) {
      const semantic = error instanceof Error && error.cause instanceof A2AError ? error.cause : error;
      if (!(semantic instanceof UnsupportedOperationError)) throw error;
      const latest = await this.snapshot(id, options);
      if (!terminal(latest)) throw error;
      yield { payload: { $case: 'task', value: latest } };
    }
  }
}

function terminal(task: Task): boolean {
  return [TaskState.TASK_STATE_COMPLETED, TaskState.TASK_STATE_FAILED, TaskState.TASK_STATE_CANCELED, TaskState.TASK_STATE_REJECTED].includes(task.status?.state ?? TaskState.TASK_STATE_UNSPECIFIED);
}
