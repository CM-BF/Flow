import { createServer, type Server } from 'node:http';
import { afterEach, expect, test } from 'vitest';
import { AgentCard, SendMessageRequest } from '@a2a-js/sdk';
import { connectA2A, RemoteOutcomeUncertainError } from '../src/index.js';

const servers: Server[] = [];
afterEach(async () => { for (const server of servers.splice(0)) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); } });
async function peer(version = '1.0', endpointOrigin?: string) {
  let sends = 0;
  const server = createServer((req, res) => {
    if (req.url === '/.well-known/agent-card.json') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(AgentCard.toJSON(AgentCard.fromJSON({ name: 'fixture', version: '1', supportedInterfaces: [{ url: endpointOrigin ?? `${url}/rpc`, protocolBinding: 'JSONRPC', protocolVersion: version }] }))));
    } else { sends++; req.resume(); req.on('end', () => res.destroy()); }
  });
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as {port:number}).port}`;
  return { url, sends: () => sends };
}
test('lost send acknowledgement is uncertain and is never retried by messageId', async () => {
  const remote = await peer();
  const client = await connectA2A({ url: remote.url, allowLoopbackHttp: true });
  await expect(client.send(SendMessageRequest.fromJSON({ message: { messageId: 'stable-message', parts: [{ text: 'work' }] }, configuration: { returnImmediately: true } }))).rejects.toBeInstanceOf(RemoteOutcomeUncertainError);
  expect(remote.sends()).toBe(1);
});
test('rejects old protocol and unapproved card endpoint before sending credentials', async () => {
  const old = await peer('0.3');
  await expect(connectA2A({ url: old.url, allowLoopbackHttp: true })).rejects.toThrow(/1.0/);
  const cross = await peer('1.0', 'http://127.0.0.1:9/rpc');
  await expect(connectA2A({ url: cross.url, token: 'owner-test', allowLoopbackHttp: true })).rejects.toThrow(/origin/);
  expect(cross.sends()).toBe(0);
});
