# C fd diagnostic：组合独审输入

当前 **0编译 / 0目标启动**。静态C/profile/schema已批准72203208；host源码2b2a37055f2e65c148f543cc9a099fafe9e09085完成20 distinct零目标行为检查，分次而非单次20/20。组合设计/entry/实际窗口尚未获批。

- [当前合同](execution-plan-v2.md)规定唯一编译、三目标、60秒及2MiB完整口径。
- [driver-input](driver-input.json)绑定运行源码、工具链、准备证据及归档预留；[host manifest](host-manifest.json)绑定完整本次交审材料。旧静态manifest和所有历史raw不改写。
- [host检查](host-checks/)：first15/15绑定19ce8b08；hardened18/18绑定b045a546；最后unref/CLI delta4/4含1新增、15未选；budget delta4/4含1新增、16未选。共20 distinct，重复项不累加。Node24原生惰性import通过且stderr空，5个mjs语法检查通过。测试仅fake child与自有临时文件；未执行31个真实child suite、未重跑27语义或19R06检查。

## 精确运行recipe（仅固定组合独审及Mika明确窗口之后）

在权威WT核对Mika窗口回执给出的完整metadata HEAD、clean状态、fresh claim v4和预约不存在；以下git/账本是窗口前只读预检，不启动任何诊断目标。HEAD与该回执不符或dirty就停止，不在运行前临时编辑entry。这里的HEAD值由最终独审回执给出，不把旧源码SHA当metadata HEAD。

```sh
cd /Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-codex-capabilities
git rev-parse HEAD
git status --porcelain
```

只在上述事实与回执一致时，执行一次且仅一次以下已固定入口，不加shell wrapper、不改参数、不以失败重试：

```sh
/opt/homebrew/opt/node@24/bin/node experiments/codex-app-server-conformance/fd-canary/execute-reviewed.mjs --reviewed-fd-window
```

入口性能clock从hash预检前开始；它在任何compiler前wx/fsync batch-reservation.json和slot-compile.json。后继slot-target-1/2/3也在各自spawn前持久消费。固定输出目录为本README所在目录，不能换目录逃避预约。新文件都是0600/wx，已存在即拒绝。

运行后只保存工具返回的safe CLI文本/exit/实际时点，在128KiB归档预留内逐文件量CLI副本、input/manifest、review/status/interface及接收收据等实际新增安全证据；raw compiler流不输出或commit。保留源输入/运行manifest的分别绑定。任何失败/unknown/retained都停止，未执行目标明确NOT_RUN；不会恢复旧clock或额外编译。未来动态runtime产物不属于本次静态manifest。

## 审查范围

完整读entry→host→command/report，特别是创建即登记、compile/target slot先持久化、预算准备证据与归档尾部、未知close/unref、最终inventory与fsync/CLI时间口径。对照722三源不变与0778847 R06复用文件不变。审查只读不重跑检查，不编译/启动。后继实际窗口另由Mika串行授予。
