# TUI01F — 聊天任务显式取消与接续

状态：in-progress；创建：2026-10-06 15:47 UTC；最近更新：2026-10-06 16:23 UTC。所属大task [TUI-001](../../../tui-client/plans/tui01-terminal-client/plan.md)，原 TODO06/08；co-lead Execution Lead。

## 小交付与 Interface

在既有聊天终端增加 `/cancel <displayed-task-id>`，typed command 为 `{type:'cancel',taskId}`；任务须来自当前可见、已观察的会话执行，不能猜最新目标。复用已有 FlowClient.cancel、单 durable intent/controller、private journal。先保存原 task/key/空 body，未知 ACK 只用显式 /recover 原请求核对。返回受理不等于 runner 停止，uncertain 不变 cancelled；Ctrl-C/quit/disconnect 不提交取消。不增加中心协议或 attempt CAS、不读取 task prompt、不复制 Web 私有状态、不造第二 FSM。

新增小 Module 是 task-control 的意图 schema/回执校验/端口；宿主 controller 仍拥有观察、草稿、连接 epoch 和唯一未决命令。候选可选 `taskControl: Pick<FlowClient,'cancel'>`，未注入显式 unsupported，中心拒绝不自动改目标重投。旧 create/send/queue journal 格式逐字兼容。统一遵循[模块化规则](../../AGENTS.md#modular-design)。

## TODO

- [x] TUI01F-01：固定源码 Interface、取消意图与终端入口，保留旧规则。
- [x] TUI01F-02：新增公开 controller 定向行为用例，明确实际执行状态。
- [ ] TUI01F-03：资源/依赖具备后，真实 HTTP 与专用 PG 丢 ACK/恢复旅程及实际 PTY 验证。
- [ ] TUI01F-04：实际 App ↔ TUI 同会话交替，CAS 拒绝保草稿与观察接续；独立 review/main 收口。

当前只授权 source/合同/用例准备。禁止安装/复制依赖/full build/PG/browser/provider；没有依赖时不借 moving main 运行，也不把 NOT_RUN 写成 red/green。A-E 已有检查作为历史输入，不重复全集。源码用例覆盖缺端口/错误目标/回执身份/原 key 重报/退出/旧 journal；03/04 待 fresh 资源窗口。有限实际 source-only 闭包见 design-input.json，runner/center 未物化，不偷用最新树。

## 验收边界

取消 API 仅 task ID+key、空请求体；没有 task-attempt CAS。原 send/queue 命令验证第二客户端引起的 revision 409：原文草稿保留、只观察、不自动换 revision 重发。JSONL 是 shared controller 消费者，非 PTY；PTY 输出与 raw-mode/resize 是终端证据，非实际浏览器。App 需固定真实构建产物/源+同后台 tuple，不能用壳页或 API 请求替代可见交互。机械 fixture 不证明所有 native/A2A cancellation，也不计 provider 验收。

源码准备已固定 `044ab84db42606fb1757903258078e3dfbab9545`，8 个公开边界用例仅源码未执行；NOT_RUN。不以源审推进 03/04 完成。

2026-10-06 16:03 UTC：追加已授权局部运行，35+1 分轮全绿（36 distinct），focused noEmit0。依赖视图由 Lead 受控创建，0安装/PG/HTTPserver/PTY/browser/provider。原 source-only NOT_RUN 说明为历史；03/04 仍开放。

2026-10-06 16:13 UTC：controller+静态Ink接线限定 APPROVED，main `83f535b54f2390a729f02bc818e07ba684d94ccb` 接收9源零差。本片段delivered不等完整TUI；03/04未勾选，下一最小source闭包见 [followup](../../docs/evidence/tui01f/followup-acceptance.md)。仍保留原claim，无新运行/产品写入。

2026-10-06 16:23 UTC：同claim实施03测试harness源码；仅fixture.ts、journey.test.ts、cancel_driver.py。最多一个随机库/一个中心与runner/A-B-C三个轮次，两项显式cancel及A原key重报。完整checkpoint成功先于DROP/rm，整个owned PGID停止未确认则保留。尚未运行，04 App driver本轮不创建。
