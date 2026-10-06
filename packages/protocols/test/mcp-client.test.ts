import { createServer, type Server } from 'node:http';
import { afterEach, expect, test } from 'vitest';
import { createMcpHandler, McpServer, inputRequired } from '@modelcontextprotocol/server';
import { connectMcp, RemoteOutcomeUncertainError } from '../src/index.js';

const servers: Server[] = [];
afterEach(async () => { for (const server of servers.splice(0)) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); } });
async function officialPeer() {
  const requests: {body:Record<string, any>; headers:Record<string,string|string[]|undefined>}[] = [];
  const handler = createMcpHandler(() => {
    const sdk = new McpServer({ name: 'official-p01-peer', version: '2.3.1' });
    sdk.registerTool('ask', {}, async context => {
      if (!context.mcpReq.inputResponses?.confirm) return inputRequired({ requestState: 'opaque-state', inputRequests: { confirm: inputRequired.elicit({ mode: 'form', message: 'Allow this?', requestedSchema: { type: 'object', properties: { allow: { type: 'boolean' } }, required: ['allow'] } }) } });
      return { content: [{ type: 'text', text: JSON.stringify(context.mcpReq.inputResponses.confirm) }] };
    });
    sdk.registerTool('echo', {}, async () => ({ content: [{ type: 'text', text: 'official tool result' }] }));
    sdk.registerTool('tool-error', {}, async () => ({ isError: true, content: [{ type: 'text', text: 'tool could not finish' }] }));
    sdk.registerResource('note', 'fixture://note', { description: 'A fixture resource' }, async uri => ({ contents: [{ uri: uri.href, text: 'resource value' }] }));
    sdk.registerPrompt('review', {}, async () => ({ messages: [{ role: 'user', content: { type: 'text', text: 'prompt value' } }] }));
    return sdk;
  }, { legacy: 'reject' });
  const server = createServer(async (req,res) => {
    try {
      let body = ''; for await (const chunk of req) body += chunk.toString();
      requests.push({ body: JSON.parse(body), headers: req.headers });
      const response = await handler.fetch(new Request(`http://${req.headers.host}/mcp`, { method: 'POST', headers: req.headers as Record<string,string>, body }));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) { res.writeHead(500); res.end(String(error)); }
  });
  servers.push(server); await new Promise<void>(resolve => server.listen(0,'127.0.0.1',resolve));
  return { url: `http://127.0.0.1:${(server.address() as {port:number}).port}/mcp`, requests };
}
test('official server interoperates through modern discovery, per-request metadata, tools, resources and prompts', async () => {
  const peer = await officialPeer();
  const client = await connectMcp({ url: peer.url, allowLoopbackHttp: true, authorizeTool: async () => true });
  try {
    expect(client.version).toBe('2026-07-28');
    expect((await client.tools()).tools.map(tool=>tool.name)).toContain('echo');
    expect(await client.callTool('echo')).toMatchObject({ content: [{ text: 'official tool result' }] });
    expect(await client.callTool('tool-error')).toMatchObject({ isError: true });
    expect((await client.resources()).resources[0]?.uri).toBe('fixture://note');
    expect(await client.readResource('fixture://note')).toMatchObject({ contents: [{ text: 'resource value' }] });
    expect((await client.prompts()).prompts[0]?.name).toBe('review');
    expect(await client.getPrompt('review')).toMatchObject({ messages: [{ content: { text: 'prompt value' } }] });
    expect(peer.requests.some(item=>item.body.method==='initialize')).toBe(false);
    expect(peer.requests.every(item=>item.body.params?._meta?.['io.modelcontextprotocol/protocolVersion']==='2026-07-28')).toBe(true);
    expect(peer.requests.every(item=>item.headers['mcp-protocol-version']==='2026-07-28')).toBe(true);
    expect(client.tasks).toMatchObject({ supported: false, reason: 'sdk-extension-not-supported' });
  } finally { await client.close(); }
});
test('tool authorization is explicit and denial never reaches the peer', async () => {
  const peer = await officialPeer();
  const client = await connectMcp({ url: peer.url, allowLoopbackHttp: true });
  try { await expect(client.callTool('echo')).rejects.toThrow(/authorized/); expect(peer.requests.filter(item=>item.body.method==='tools/call')).toHaveLength(0); }
  finally { await client.close(); }
});

test('official multi-round elicitation reaches the host once and echoes opaque request state with a new request ID', async () => {
  const peer = await officialPeer(); let asked = 0;
  const client = await connectMcp({ url: peer.url, allowLoopbackHttp: true, authorizeTool: async () => true, elicit: async request => { asked++; expect(request.message).toBe('Allow this?'); return { action: 'decline' }; } });
  try {
    const result = await client.callTool('ask');
    expect(result.content).toEqual([{ type: 'text', text: '{"action":"decline"}' }]);
    const calls = peer.requests.filter(item=>item.body.method==='tools/call');
    expect(asked).toBe(1); expect(calls).toHaveLength(2);
    expect(calls[1]?.body.params.requestState).toBe('opaque-state');
    expect(calls[1]?.body.id).not.toBe(calls[0]?.body.id);
    expect(calls[1]?.body.params.inputResponses).toEqual({ confirm: { action: 'decline' } });
  } finally { await client.close(); }
});
