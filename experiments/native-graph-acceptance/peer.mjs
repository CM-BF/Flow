import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { EXPECTED_TOOLS, TITLES } from './config.mjs';
const require = createRequire(new URL('../../apps/runner/package.json', import.meta.url));
const { Client } = await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/index.js')).href);
const { InMemoryTransport } = await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/inMemory.js')).href);
export async function connectPeer(server) {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const peer = new Client({ name: 'flow-o08-zero-query-peer', version: '1.0.0' });
  await server.instance.connect(serverSide); await peer.connect(clientSide); return peer;
}
export async function rehearseQuery(input, report) {
  const server = input.options.mcpServers['flow-graph']; const peer = await connectPeer(server);
  try {
    const tools = await peer.listTools();
    report.mcpTools = tools.tools;
    const names = tools.tools.map(tool => `mcp__${server.name}__${tool.name}`).sort();
    if (JSON.stringify(names) !== JSON.stringify([...EXPECTED_TOOLS].sort())) throw new Error('MCP tool names differ');
    async function call(name, args) {
      const hook = input.options.hooks.PreToolUse[0].hooks[0];
      const decision = await hook({ hook_event_name: 'PreToolUse', tool_name: `mcp__${server.name}__${name}`, tool_input: args,
        tool_use_id: `o08-${report.wire.length}`, mcp_server: { name: server.name, source: 'sdk' } }, undefined, { signal: input.options.abortController.signal });
      if (decision.hookSpecificOutput.permissionDecision !== 'allow') throw new Error('Host policy denied the rehearsal');
      const response = await peer.callTool({ name, arguments: args });
      report.wire.push({ name, args, response, responseBytes: Buffer.byteLength(JSON.stringify(response)) });
      if (response.isError) throw new Error('Center rejected a rehearsal command');
      return JSON.parse(response.content[0].text);
    }
    const base = await call('graph_read', { request: { view: 'graph', limit: 3 } });
    if (base.nodes.length || base.baseRevision !== 1 || base.stale) throw new Error('Expected a fresh empty graph');
    const proposal = { expectedProjectRevision: 1, reason: '仅为合成发布说明建立三步计划', additions: TITLES.map((title, i) => ({ key: `step${i + 1}`, title,
      dependencies: i ? [{ kind: 'proposed', key: `step${i}` }] : [] })) };
    const proposed = await call('graph_command', { command: { kind: 'propose', proposal }, idempotencyKey: 'o08-propose-once' });
    await call('graph_command', { command: { kind: 'apply', proposalId: proposed.proposal.id, expectedProjectRevision: 1,
      proposalDigest: proposed.proposal.proposalDigest }, idempotencyKey: 'o08-apply-once' });
  } finally { await peer.close(); }
}
