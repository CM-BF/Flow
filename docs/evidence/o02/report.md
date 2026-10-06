# O02 原生目标工具桥接证据

固定实现 `d8198b13a15a0e27ef1686afa8495916a6aa8abc`；Node24.20.0 / pnpm9.15.4 / Vitest4.0.18。本片段可交独立审查，尚未集成 main。0 模型 / 0 query / 0 认证网络 / 0 runner 执行。

## 真实检查

[checks-final.txt](checks-final.txt)：6 个本模块测试 + 2 个既有纯 handler 直接消费者 = **8/8**，4 files，1.87s；[typecheck-final.txt](typecheck-final.txt) 通过。不是整库测试。测试沿公开 MCP initialize/tools/list/tools/call → SDK server instance → createGoalTools → FlowClient → 真实中心 HTTP/PG；没有 fake MCP server。

- 真实固定 Claude SDK `0.3.290`、MCP SDK `1.32.1`、Zod `4.6.5`；实际 initialize 协议 **2025-11-25**，tools capability 已观察。不宣称 2026 新规范。
- 只读 annotation、受限节点/命令、非法分页参数、旧快照引用、窗口之外的解释、超大响应均有断言；整个固定 goal 概览可见，完整输入/命令按节点授权。
- 专用 `flow_o02_<UUID>` + 动态端口，真实 createServer 内置 goals 路由。两次中心重启与 fresh SDK server，原 command key 原结果 replay，变更同 key/过期版本 409；越权节点在 host 拒绝。
- 执行命令只证明中心持久受理到 queued，未启动 runner。真实中心 commit 后 port 有意丢 ACK/抛私密异常，再重启中心并同 key 重试：仍 inputVersion=2、只有两次定义解释；旧 version=1 输入原文可读。异常正文未泄露。此窗口是确定性故障注入，不是 OS hard-kill。
- `afterAll` 正常 close + DROP 自己创建的 DB；2026-10-06T04:19:24Z 独立只读库存查询 `flow_o02_%` 为空，无停止他人服务。

## 有界正文与字节

原始 [wire.json](wire.json) 记录真实 transport.send 上 JSON-RPC message 与 UTF-8 JSON 字节；进程内 InMemoryTransport，没有 TCP/TLS/压缩或浏览器计时。合成同一200节点、50解释窗口，稠密无环依赖；只是功能/字节检查，不是性能 benchmark。

| 记录 | 字节 |
| --- | ---: |
| 权威 GoalSnapshot 的 JSON（对比输入，并非另一条实发 MCP） | 1,008,415 |
| 默认5节点实际 MCP JSON-RPC 回复 | 3,259 |
| 原始 goal 原文按需实际回复 | 17,379 |
| version=1 完整输入实际回复 | 17,332 |
| 单条解释实际回复 | 3,099 |
| 第200节点的199依赖列表实际回复 | 8,941 |

40页覆盖全部200节点、顺序与数量一致；输入及 goal 中文/emoji精确相等。所有观察消息最大17,379字节。编码后的 MCP result（含text转义）硬上限65,536字节；JSON-RPC envelope 在此之外有少量固定开销，超限返回明确 isError，绝不静默截断。

**未测 token**：没有调用 tokenizer / query / 模型，模型包装与分词均未知；不提供数字估算或节约百分比。字节只能支持有界协议正文结论。

## 限制和后继

每次概览/详情仍经既有 port 读取并 hash 完整中心快照；这减少发送给 MCP caller 的正文，并未优化中心查询/FlowClient传输/内存。快照有变化时分页/详情明确 stale_snapshot，不做盲重试；输入版本独立且持久。解释原文只在中心当前最多50条窗口可读，窗口外 not_available，不虚构历史存储接口。

工具命令失败不代表没有 commit；未知异常、断开/取消 MCP 连接或超过响应大小，都不能宣称中心事务撤销。bridge 不自动重发。具体 4xx 只回安全 status，其余 outcome_unknown；调用者用同 key 核对。SDK annotations 仅提示，授权来自 host 固定 GoalToolOptions。

未调用 SDK query，未挂现 runner main，未验自然语言规划、真实模型成本/预算、模型自动选择工具、SDK进程重启/OS hard-kill。U11/O01 自然语言产品目标保持 open。架构影响待 Lead 接收后更新固定图，标记新增 adapter、未挂载。

## 复跑

在本 worktree，已有 PG localhost:55432 可用时：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm install --frozen-lockfile
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm typecheck
FLOW_O02_EVIDENCE_DIR=/tmp/flow-o02-review-unique PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run apps/runner/src/goal-tools-mcp apps/runner/src/goal-tools/goal-tools.test.ts --no-cache --configLoader runner
```

输出目录必须新建或未包含 wire.json，文件采用 wx 防覆盖。不会运行 query，也不需要凭据登录。

官方 API 来源：[Claude custom tools](https://code.claude.com/docs/en/agent-sdk/custom-tools)，结合本机固定 sdk.d.ts 核对 createSdkMcpServer/tool；不把 latest 文档当固定发布包保证。方法/失败记录见 [quality.md](quality.md)，哈希见 [manifest.json](manifest.json)。
