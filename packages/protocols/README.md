# Flow protocols

Node24的官方SDK适配库。A2A规范1.0.0 / JSONRPC；MCP2026-07-28 / Streamable HTTP。A2A SDK1.3.0，MCP client/server2.3.1。完整限制和权威说明见[设计](../../docs/architecture/p01-protocols.md)。

```ts
import { FlowClient } from '@flow/client';
import { createA2ABridge, connectMcp } from '@flow/protocols';

const bridge = createA2ABridge({
  flow: new FlowClient({ baseUrl: process.env.FLOW_URL!, token: process.env.FLOW_TOKEN! }),
  token: process.env.FLOW_A2A_TOKEN!,
  submission: { harness: 'fixture' },
});
bridge.listen(0, '127.0.0.1');
// During shutdown: await bridge.shutdown();

const tools = await connectMcp({
  url: process.env.MCP_URL!,
  token: process.env.MCP_TOKEN,
  // Authorize using the host's permission/decision policy. Default denies calls.
  authorizeTool: async request => request.name === 'explicitly-approved-tool',
});
try { const page = await tools.tools(); /* inspect before invoking */ }
finally { await tools.close(); }
```

A2A新任务是ROLE_USER text parts；补充输入是带taskId的单data part `{decisionId,answer}`。显式Idempotency-Key由中心持久去重；messageId本身不保证去重。订阅/读取断线不取消；CancelTask返回当前权威状态，pending不等于已停止。`RemoteOutcomeUncertainError`需核对，不能盲重试。

MCP Tasks仅能力检测，`supported:false`；不向server宣称该扩展。HTTP取消关闭请求流；不能推断远端工具停止。MCP host elicitation callback尚不等于Flow已持久人工等待。

测试必须使用独立本地 `flow_p01`，会清空该库的flow/pgboss schema；其他数据库不读取/清理。测试均0模型、0云、动态端口。

```
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm install --frozen-lockfile
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm typecheck
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run packages/protocols/test
```
