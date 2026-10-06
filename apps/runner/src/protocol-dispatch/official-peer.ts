import { createServer } from 'node:http';
import { AgentCard, Task, type CancelTaskRequest } from '@a2a-js/sdk';
import { AgentEvent, DefaultRequestHandler, InMemoryTaskStore, JsonRpcTransportHandler, ServerCallContext } from '@a2a-js/sdk/server';

/** Independently hosted official SDK peer. Its in-memory store is a test fixture, not Flow persistence. */
export async function officialPeer() {
  const store = new InMemoryTaskStore();
  const context = new ServerCallContext({ requestedVersion: '1.0' });
  const counts = { sends: 0, gets: 0, cancels: 0 };
  const exchanges: { method: string; historyLengthPresent: boolean; historyLength: unknown; responseBytes: number; historyCount: number }[] = [];
  let history: Task['history'] = [];
  let current: Task | undefined;
  let transport: JsonRpcTransportHandler;
  let card: AgentCard;
  let holdAck = false;
  let releaseAck: (() => void) | undefined;
  const server = createServer(async (request, response) => {
    try {
      if (request.method === 'GET') { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(AgentCard.toJSON(card))); return; }
      let raw = ''; for await (const chunk of request) raw += chunk.toString();
      const body = JSON.parse(raw);
      if (body.method === 'SendMessage') counts.sends++;
      if (body.method === 'GetTask') counts.gets++;
      if (body.method === 'CancelTask') counts.cancels++;
      const result = await transport.handle(raw, context);
      if (body.method === 'SendMessage' && holdAck) await new Promise<void>(resolve => { releaseAck = resolve; });
      if (response.destroyed) return;
      const serialized = JSON.stringify(result);
      if (body.method === 'SendMessage' || body.method === 'GetTask') {
        const selection = body.method === 'SendMessage' ? body.params.configuration ?? {} : body.params;
        const reply = JSON.parse(serialized).result;
        exchanges.push({ method: body.method, historyLengthPresent: Object.hasOwn(selection, 'historyLength'), historyLength: selection.historyLength,
          responseBytes: Buffer.byteLength(serialized, 'utf8'), historyCount: (reply?.task ?? reply)?.history?.length ?? 0 });
      }
      response.setHeader('Content-Type', 'application/json'); response.end(serialized);
    } catch { response.destroy(); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  card = AgentCard.fromJSON({ name: 'P02 official peer', version: '1.3.0', capabilities: { streaming: false }, supportedInterfaces: [{ url: `${url}/a2a`, protocolBinding: 'JSONRPC', protocolVersion: '1.0' }] });
  class DelayedCancellationPeer extends DefaultRequestHandler {
    // Fault fixture: an ACK carrying a working Task is deliberately not proof of cancellation.
    override async cancelTask(_request: CancelTaskRequest, _context?: ServerCallContext): Promise<Task> { return structuredClone(current!); }
  }
  transport = new JsonRpcTransportHandler(new DelayedCancellationPeer(card, store, {
    async execute(request, bus) { current = { ...Task.fromJSON({ id: request.taskId, contextId: request.contextId, status: { state: 'TASK_STATE_WORKING' } }), history }; bus.publish(AgentEvent.task(current)); bus.finished(); },
    async cancelTask(_id, bus) { bus.publish(AgentEvent.task(current!)); bus.finished(); },
  }));
  return {
    url, counts, exchanges, get taskId() { return current?.id; },
    setHistory(messages: Task['history']) {
      if (current) throw new Error('Set fixture history before execution.');
      history = structuredClone(messages);
    },
    holdSendAck() { holdAck = true; },
    async finish(content: string | null, cancelled = false) {
      if (!current) throw new Error('No remote task yet.');
      current = { ...Task.fromJSON({ id: current.id, contextId: current.contextId, status: { state: cancelled ? 'TASK_STATE_CANCELED' : 'TASK_STATE_COMPLETED' },
        artifacts: content === null ? [] : [{ artifactId: 'result', name: 'Remote result', parts: [{ text: content }] }] }), history: current.history };
      await store.save(current, context);
    },
    release() { holdAck = false; releaseAck?.(); },
    async close() { releaseAck?.(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); },
  };
}
