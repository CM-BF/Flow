# TUI01F-04：同一会话的真实双界面接续（候选）

2026-10-06 17:57 UTC。仅设计，0 imports/tests/PG/PTY/browser/provider。沿 TUI-001 原 TODO06/08；不新增产品协议或第二状态机。03已交付不等于本项完成。固定输入见 [bindings](web-handoff-inputs.json)。

## 一条最小旅程

一个空合成会话、一个实际 Ink PTY、一个专用 Chrome page、一个专库/真实 createServer/fixture runner；两个实际任务。TUI使用已main的controller，Web直接服务已保留的生产artifact，无壳页、无headless替代。

1. TUI输入中文多行草稿并发送。仅在测试HTTP桥截住本次真实POST（原key/body/revision），短暂延迟转发。Web在同一会话实际点击Send，中心受理A并将revision从r推进r+1，实际DOM显示A运行。
2. 原样放行TUI已冻结请求。中心真实返回409 conversation_revision_conflict（当前命令先校验revision再校验活动任务）。断言终端显示拒绝、原草稿完整保留，只有一次该POST，没有改revision或自动重投。继续观察真实A。
3. 明确模拟用户清空编辑框后输入 `/cancel <displayed A>`，不是应用静默抹草稿。终端受理提示不等于停止；等待Web实际DOM与公开状态同为A取消。仅一个新的cancel，不重复03的lost-ACK旅程。
4. Web实际发送B，TUI显式 `/recover`（此时无未决intent，只读取）后显示同B。TUI保留新的未发送草稿并退出；确认无B取消请求，Web仍显示B运行。释放既有fixture屏障，Web显示B最终结果。退出观察不等于取消执行。

每步分别绑定真实DOM、PTY字节/事件、公开HTTP身份及只读中心佐证；API事实不能代替界面可见。自然发生未知ACK时保留原intent/key/body并收束为unknown，不自动补发。03已证明原key恢复，本场景不再注入相同丢ACK。

## 责任与最小接口

现 controller 独占草稿、pending intent、revision和恢复；中心继续独占授权/CAS/任务状态，adapter屏障仅确定性控制两项fixture任务。新实验只拥有界面驱动、唯一延迟请求和观察日志。

复用 `CancelJourney` 的启动/marker/目录identity、runner/server停止、≤3s连接观察、checkpoint→DROP/rm。现取消专用proxy仅允许GET与cancel，不能用它发送Web/TUI新轮次；仅给test fixture增加窄只读连接描述 `{ origin, token, conversationId }` 及已拥有的PTY注册/退出端口，由同一fixture拥有进程组。token只在内存和私有运行目录，报告禁回显。新bridge允许本会话两个turns和A的一次cancel，绑定返回身份；拒绝其他写口，不改业务响应或revision。

拟源码位置（均须Lead确认后才实施）：

- `experiments/tui-web-control-handoff/journey.ts`：单场景及有界证据。
- `experiments/tui-web-control-handoff/preview.ts`：复用固定 `tools/personal-preview/web-artifact.mjs` / `web-release.mjs` 的验证与release asset规则，静态HTTP/受限代理；不复制发布权威。
- `experiments/tui-web-control-handoff/terminal.py`：实际PTY分步驱动，复用03的终端交互方法；旧cancel_driver.py保持。
- `apps/tui/src/task-controls/fixture.ts`：上述test-only端口，保留旧两行为不变。
- 既有 `plans/tui01f-task-cancel` / `docs/evidence/tui01f`：唯一状态/证据。

这些路径由现claim v2覆盖；本轮只有plan/evidence写入，未获得driver实施或运行窗口。若复用静态模块尚未物化，仅请求Lead从固定base恢复确切路径；不借moving产品树、不改公共工具/依赖。

## 固定真实消费者与待协调项

TUI/fixture以ec30七源组合和旧后台a89为候选，不追main后台。Web候选为source `5069586a9f17332de526e101eca3a4250cbc8d91`、artifact `d629631d21eedd2afa308c562b31e57fc8597703a57a4c989c5a4af4fefd5e88`、release `388371a4972c469b8ace623454594132`。本次只读核10文件/1,588,311B全同manifest。Lead需确认Web owner保留并共享该只读artifact目录；不读取个人pointer/安装/重建。

实际App入口：Owner token / Connect workspace；Conversations navigation按合成title选择；Message input / Send message。使用固定source真实可见pane内定位，不调用私有React状态。当前RELEASE03已审的是af51+d629，**不证明拟a89+d629新tuple兼容**；本场景仅plain v1聊天，无附件/知识历史/模型能力外推。Lead可要求采用已审af51后台，但那需显式新输入及其源/SQL闭包，不可偷偷换源。

## 运行与性能边界（尚未授权）

沿独立随机库/动态端口/专用Chrome与PTY，不触个人服务或用户tab。预计1中心+1runner、一个Chrome会话、一个PTY；原fixture取消proxy和新增静态/延迟proxy各有独立关闭责任。建议最多120s行为+60s清理、raw≤4MiB、私有增量≤16MiB为观察阈值，Chrome/PG/WAL另计；需另核实际依赖/空间和新窗口，不把03预算自动继承或视作硬上限。

结束先停止并核整个owned组、关闭runtime/HTTP/pools，保存完整checkpoint后才正常DROP与同dev/ino删除；未知保留，无FORCE、无自动重试。失败仍保存DOM/PTY/请求身份与清理事实。只选此1场景，不重跑03两行为、36局部或10purecleanup。

设计复核使用本地find-skills、codebase-design、clean-code、brainstorming及webapp-testing：状态所有权单一、真实消费者小端口、可见界面断言与后端佐证分开、持续轮询不以networkidle代替确定条件。路径/hash记在bindings；没有安装或调用浏览器。
