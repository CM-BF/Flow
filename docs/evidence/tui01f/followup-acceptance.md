# TUI01F-03/04 最小后继（只读准备，未运行）

TUI 固定 `a1f82f36a5e63f859ecdcdbd1da3575724e82101`，已 main `83f535b54f2390a729f02bc818e07ba684d94ccb`；后台输入继续固定 `a89f42ab57acb53657af6a2d1b745dabd4d50aa5`，不借 moving-main 产品。以下仅下一有界验收提案，个人服务、Web A2 窗口及未授权安装/PG/浏览器均不操作。

## 最小同一旅程

03 用一个随机专库、一个生产 `createServer` 动态端口、一个 `runRunner` fixture adapter 生命周期。fixture 显式登记 claude-compatible synthetic session 以满足真实 follow-up 归属，但绝不创建 SDK query；先发 session，再通过测试屏障等待取消或释放，不靠延长 sleep 制造观察窗口。复用原 FlowClient/controller/journal/outbox/runner，并保留正常 task 与 attempt 权威状态。

只准备最多一个会话、三个合成轮次 A/B/C、两个 explicit cancel：

1. A 开始后，TUI 控制器通过自有 proxy 发 `/cancel A`；proxy 仅在中心确认 POST 已返回后丢一次 ACK。日志只留 URI、key、固定空 body 及回执状态，不留 token。关闭/重开同 journal 不发送；另一公开 client 待 A cancelled 且 session 已释放后显式发 B（固定 admission 源允许 cancelled 后 follow-up，automatic queue 则不同，不伪造同规则）。
2. TUI `/recover` 必须仍向 A 同 URI/key/body，不能改成 B；读到 B 的当前状态。PTY 中真实输入 `/cancel B` 并可见受理→中心 cancelled，回执与实际停止分开。运行中的 B 被取消是 fixture 事实，不外推 native/A2A。
3. 明确创建 C 后，PTY 保留中文/emoji/多行未发送草稿、resize，Ctrl-C 退出。C 无 cancel POST，仍由 fixture 屏障释放至成功。checkpoint 成功落盘后才删除 DB/tmp，异常标 unknown/保留恢复证据。

04 复用同一中心/runner/会话上下文，将步骤中 B/C 的第二公开 client 替换为**实际 App DOM**动作，实际 TUI→Web→TUI 证据不能用 headless/API 替代。Web 从同一 conversation URL 打开，显示取消结果、提交一个明确 follow-up；TUI 重开后观察同 turn/task。Web 未发草稿不应丢。选择性让 Web 改 revision、TUI 保留原 draft 的旧 send 得到 409，然后只 recover 观察；不自动换 revision 重投。cancel 本身没有 CAS，不虚构取消版本冲突。

阶段03先局部 HTTP/PG+PTY；阶段04另等 Web owner 提供固定实际 App artifact/bundle/descriptor 后组合，不能用 fixture 壳或把尚缺 Web 变成03阻塞。两阶段可共享测试 harness，原35+1无需重跑。

## 源码与依赖准备

[followup-source-closure.json](followup-source-closure.json) 是静态 import/export/require 字面量递归（包含 type imports）的保守本仓库闭包，外加全部固定 SQL 资源。当前需由 Lead source-only 物化 **173 个缺文件、704,532 个逻辑源码字节**。完整清单绑定固定 ref/hash；不是物理峰值，也没有实际物化/导入。所需模块主要是 apps/server 生产 factory 依赖、apps/runner runtime/verifier 与私有桥接依赖、packages/plugin-runtime、28 个固定 migration SQL、各 package manifests；不补旧业务测试全集。

第三方追加候选以原固定 manifest/lock 为准：fastify5.12.5、@fastify/cors11.3.0、pg8.23.1、pg-boss12.37.0、pacote21.5.1、npm-package-arg13.0.2、ssri13.0.1、tar7.5.22，以及 TUI03 子进程所需 tsx4.23.15。这些可能由 production factory 静态 import 引入，即使可选host未启用也不能假定无需解析。现依赖视图不证明它们存在，Lead 可先核既有 donor；workspace alias 仍只能指候选固定源，不修改 donor、不全量安装/复制。浏览器阶段另需已有 Playwright1.63.0 与已装 Chrome，不能提前运行或安装。

需要创建的测试源码全部在既有 claim：

- `apps/tui/src/task-controls/fixture.ts`：私有随机 DB/中心/fixture runner 屏障、请求计数、完整 checkpoint 与受控清理；不复制 domain FSM。
- `apps/tui/src/task-controls/journey.test.ts`：2 个选择场景（实际丢 ACK恢复、真实PTY取消/退出），共用上述一个生命周期。
- `apps/tui/test-fixtures/cancel_driver.py`：真实自有PTY编辑/resize/退出断言。
- `experiments/tui-web-control-handoff/driver.mjs`：实际 App+PTY 同会话控制旅程；仅公共 API/DOM，不调用 Web 私有 controller 或另造状态。

预计新增测试/harness源码 ≤30KiB、原始文本≤2MiB；是否需要≤2张截图由Web slot和实际视觉问题决定，不能提前声称同8MiB窗口可容纳PG/Chrome。03建议运行前重新核至少1GiB保留量+32MiB专用余量，04至少1GiB+64MiB并与Web owner互斥，**这些是后继候选门槛，尚未替换Lead/OPS批准门禁**。setup/closure真实空间若更高就停止，不以逻辑源码字节推峰值；不得启动2.5GiB门槛未满足的full build或新大安装。

## 现脚本复用边界

- 复用已发布 controller/client/private-journal 与 runRunner/createServer；queue-controls/journey.test.ts 仅作为已审有限生命周期/ACK-drop写法参考，其 helpers 未导出，不整体 import 从而跑旧4场景。
- queue_driver.py 作为PTY协议/termios restore模式参考；新cancel_driver只替换新控制动作，不把JSONL代替PTY。原脚本顶层会创建子进程，不作为库执行。
- stream-ui-acceptance/journey.mjs 仅参考实际 focused pane、Message input、same conversation DOM 与 checkpoint模式，其固定 one-create/one-turn/stream路径不符合本片，不整体执行。
- scripts/web-system-probe.ts 使用固定历史 DB/drop-schema 且旧 task UI，**不执行、不复制固定DB清理**；仅保留来源参考，实际03/04均随机专庫与自有 PID/目录。

App tuple 必填：TUI commit/source hashes + backend commit/migration hashes + App artifact descriptor/完整asset hash/其真实source + HTTP origin/浏览器上下文身份。Web owner 若只能提供不同source的既有artifact，则先明确兼容tuple并独审；不能把控制器main接收推成App通过。无正式source/依赖/resources输入就保持NOT_RUN。

本报告未运行 tests/typecheck/build/PG/PTY/browser/provider、未生成新driver、未改任何产品。记录 2026-10-06 16:13 UTC。
