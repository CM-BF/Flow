# 当前局部验证

2026-10-06 16:03 UTC：固定候选 `a1f82f36a5e63f859ecdcdbd1da3575724e82101`，36 个不同定向/直接消费者用例分两轮通过，focused noEmit exit0；没有真实 HTTP/PG、PTY、浏览器或 provider。见 [validation.md](validation.md) 与 [validation-manifest.json](validation-manifest.json)。独立源码预检无 P1/P2，但增量执行证据尚待独审；不是完整 TUI 验收。

以下保留首次 source-only 准备说明及当时 NOT_RUN 边界。

# TUI01F：明确取消聊天任务（源码准备）

终端新增 `/cancel <displayed-task-id>`；JSONL 使用同一个公开 controller。只接受当前聚焦/最新会话轮次或队列 current task 的明确 ID。操作沿用现有私有 journal、唯一 intent、公开 FlowClient.cancel；保存原 conversation/turn/task、key 和空 body，未知回执后只允许显式恢复原请求。退出不取消，取消不清未发送草稿，也不替用户暂停队列。

固定实现 `044ab84db42606fb1757903258078e3dfbab9545`，输入 `a89f42ab57acb53657af6a2d1b745dabd4d50aa5`。本片 **SOURCE_READY / NOT_RUN**：8 个行为用例仅保存源码（7 controller + 1 真实私有 journal/JSONL 消费者用例）。未执行测试、类型检查、HTTP/PG、PTY、浏览器或 provider；没有 red/green 或运行通过结论。未安装、导入第三方包或生成 node_modules。`git diff --check` 与 21 个直接输入的固定字节核对是静态准备证据，不代替行为验证。

## 模块与边界

| 模块 | 职责 / 不变量 |
| --- | --- |
| interaction/task-control | 严格 task-cancel schema、可选单方法端口、taskId/已知取消回执状态验证。 |
| 原 controller | 唯一草稿、连接 epoch、durable intent 与显式恢复；没有新 FSM。 |
| TUI main/screen | 注入已发布 client，展示当前任务 ID；slash 和 JSONL 共用命令。 |
| 原中心 cancel | 原 key + task 范围，无 attempt CAS；权威状态可能 cancel_requested、cancelled、succeeded、failed 或 uncertain。 |

旧 create/send/queue schema、journal IO、headless IO、ack decoder、公开 client、中心和退出逻辑保持固定输入。新增意图不向服务端发送 conversation/turn 或伪造版本条件。收到旧 ACK 后刷新权威事实，不将其投影为最新执行状态。状态 uncertain 不自动变成 cancelled，native/A2A 实际停止不在本片证明范围。

读取边界不变：取消仅新增一个 POST；随后复用原会话/最多 20 轮轻读和已打开队列页。未新增 task prompt/detail 读取或自动 provider 调用。队列控制与取消分别保持原语义；本片不包含取消排队项、人工决定或 steer。

## 下一次局部检查入口（尚未授权执行）

在 Lead 准备本候选自有 workspace alias、固定第三方依赖视图和固定配置后，只选择：

- `packages/interaction/src/task-control/controller.test.ts`
- `apps/tui/src/task-controls/consumer.test.ts`
- 受影响旧 controller/queue 单 intent 消费者，按风险选择；不重复旧 PG/PTY 全套。

[dependency-proposal.json](dependency-proposal.json) 记录现有 I02 第三方 manifests 的实际路径/版本/hash，不能把 donor 的 workspace 产品链接过来。Vitest 4.0.18 / Zod 4.6.5，类型准备还需 TypeScript 5.9.3、Node types 24.19.1 与已声明 TUI React/Ink 包。transitive 路径、运行资源和实际解析仍待验证；没有新依赖请求。

真实 HTTP/PG、实际 PTY 与实际 App→TUI→App 的 source closure/资源窗口尚缺。TTY resize/CJK/退出不能由 JSONL 推断；真实 browser 也不能由 API 断言冒充。后续保持原 `design-input.json` 的小旅程，不扩大成新 API 菜单。原 source-only resource 限制仍有效，个人服务从未操作。

时间：2026-10-06 15:55 UTC。独立审查待 Lead 安排，空模板不表示通过。
