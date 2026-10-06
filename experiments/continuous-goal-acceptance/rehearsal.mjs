import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { connectPeer } from '../native-graph-acceptance/peer.mjs';
import { DECLARATIONS, GRAPH_TOOLS, MATERIAL } from './config.mjs';

function init(phase, session) {
  return { type: 'system', subtype: 'init', uuid: randomUUID(), session_id: session, model: DECLARATIONS.model,
    claude_code_version: DECLARATIONS.runtimeVersion, permissionMode: 'dontAsk', tools: phase === 'plan' ? [...GRAPH_TOOLS] : ['Read'],
    plugins: DECLARATIONS.plugins.map(name => ({ name })), skills: [...DECLARATIONS.skills],
    mcp_servers: phase === 'plan' ? [{ name: 'flow-graph', source: 'sdk', status: 'connected' }] : [] };
}
async function allow(input, name, args, id, graph = false) {
  const result = await input.options.hooks.PreToolUse[0].hooks[0]({ hook_event_name: 'PreToolUse', tool_name: name,
    tool_input: args, tool_use_id: id, ...(graph ? { mcp_server: { name: 'flow-graph', source: 'sdk' } } : {}) }, undefined,
  { signal: input.options.abortController.signal });
  assert.equal(result.hookSpecificOutput.permissionDecision, 'allow');
}
async function propose(input, citation, row) {
  const peer = await connectPeer(input.options.mcpServers['flow-graph']);
  try {
    assert.deepEqual((await peer.listTools()).tools.map(t => t.name).sort(), ['graph_command', 'graph_read']);
    async function call(name, args) {
      const id = randomUUID(); await allow(input, `mcp__flow-graph__${name}`, args, id, true);
      const result = await peer.callTool({ name, arguments: args }); assert(!result.isError);
      assert(Buffer.byteLength(JSON.stringify(result)) <= 131_072); return JSON.parse(result.content[0].text);
    }
    const graph = await call('graph_read', { request: { view: 'graph', limit: 2 } });
    assert(!graph.stale && graph.nodes.length === 0);
    // Deliberately synthetic transport fixture. Native mode never imports or calls this proposal recipe.
    const proposal = { expectedProjectRevision: graph.baseRevision, reason: 'Zero-query consumer wiring only', additions: [
      { key: 'draft', title: '起草说明', dependencies: [] },
      { key: 'final', title: '核对并修订', dependencies: [{ kind: 'proposed', key: 'draft' }] },
    ], inputProposal: { protocol: 'flow.goal-input-proposal.v1', nodes: ['draft', 'final'].map(key => ({ key, input: {
      goal: key === 'draft' ? '根据固定纸鸢材料写发布说明草稿。' : '核对依赖草稿与固定纸鸢材料，并给出修订后的简洁发布说明。',
      constraints: '只读指定材料，不编造事实；不写文件、不联网、不执行终端。',
      acceptance: '包含纸鸢0.1、草稿预览、内部测试且尚未正式发布，独立用户确认。',
      verification: { kind: 'nonempty' }, knowledge: [citation],
    } })) } };
    const result = await call('graph_command', { command: { kind: 'propose', proposal }, idempotencyKey: 'o16-rehearsal-proposal-once' });
    row.rehearsalProposalId = result.proposal.id;
  } finally { await peer.close(); }
}
export function rehearsalQuery(phase, citation) {
  return (input, binding, row) => Object.assign((async function* () {
    const session = `o16-rehearsal-${binding.slot}`; yield init(phase, session);
    if (phase === 'plan') await propose(input, citation, row);
    else {
      const paths = input.prompt.split('\n').filter(line => line.startsWith('Authorized material: ')).map(line => line.slice(21));
      assert.equal(paths.length, 1); const id = randomUUID();
      await allow(input, 'Read', { file_path: paths[0] }, id);
      const text = await readFile(paths[0], 'utf8'); assert.equal(text, MATERIAL);
      yield { type: 'assistant', uuid: randomUUID(), session_id: session, parent_tool_use_id: null,
        message: { role: 'assistant', content: [{ type: 'tool_use', id, name: 'Read', input: { file_path: paths[0] } }] } };
      yield { type: 'user', uuid: randomUUID(), session_id: session, parent_tool_use_id: null,
        message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: text }] } };
      if (binding.slot === 'child-2') assert(input.prompt.includes('纸鸢0.1新增草稿预览能力，目前处于内部测试，尚未正式发布。'));
    }
    yield { type: 'result', subtype: 'success', is_error: false, uuid: randomUUID(), session_id: session,
      result: phase === 'plan' ? '已提出两个有依赖的实际输入，等待owner确认，未执行子任务。'
        : binding.slot === 'child-1' ? '纸鸢0.1新增草稿预览能力，目前处于内部测试，尚未正式发布。'
          : '纸鸢0.1加入草稿预览功能。当前版本仍在内部测试，尚未正式发布。',
      num_turns: phase === 'plan' ? 3 : 2, total_cost_usd: 0, modelUsage: {}, permission_denials: [] };
  })(), { close() {} });
}
