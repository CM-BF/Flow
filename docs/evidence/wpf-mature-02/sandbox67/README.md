# Sandbox syscall 67：单项bootstrap候选（准备中，未开放执行）

2026-10-06 11:59:05 UTC。GO已选择第二条候选并给后续唯一窗口名`go-c-sandbox67-once`；当前只准备源码/固定输入，由status_read（≥Sol）独立审查、Mika核门禁后才执行。原claim0dd97484 v4涵盖实验/证据/计划，无需amend。

新profile逐字保留v3 candidate，仅末尾新增：

```scheme
(allow system-mac-syscall (require-all (mac-policy-name "Sandbox") (mac-syscall-number 67)))
```

来源为上游固定6b9826e的[平台policy](https://github.com/openai/codex/blob/6b9826e3aa83b1a5947db50f4332cb9c65f1b340/codex-rs/sandboxing/src/seatbelt_read_only_platform_defaults.sbpl#L43)。它是容器是否预期的bootstrap候选，不是旧SIGABRT根因结论。没有vnguard、sysctl、Mach或新path grant；原文件/网络/进程限制保留。

## 最小Module/Interface

复用已审v3 `runFdCanaryBatch`全部生命周期、budget、cleanup和report parser。host/command/report/R06逐字冻结；共享entry只增加`v3|sandbox67`固定枚举及同一CLI gate，新目录薄entry不能接任意profile/path。新目录C是固定原C输入副本，检查逐字同hash，不维护另一算法。旧v3 entry/test的历史target保持Git语义，不能拿旧manifest声称当前这两个变更文件仍WT相同；原C/profile/schema/raw/archive不改。

实际顺序仍唯一：1次clang→无profile socket控制→新profile regular-file C目标；最多2个C目标，没有Node/Codex/SDK/provider/auth/network/log collector目标。父regular文件身份与子报告独立；合法负errno不伪造观察成功。编译输出先保存0600/wx/fsync清单后再health/parser；unknown/close/accounting失败立刻停止、保留准确身份，不重试、不补grant。

未来唯一命令（现在禁止运行）：

```sh
/opt/homebrew/opt/node@24/bin/node experiments/codex-app-server-conformance/sandbox67/execute-reviewed.mjs --reviewed-sandbox67-window
```

独审绑定source/input/manifest后，fresh v4/clean完整HEAD、固定外部fingerprints及八个预约/slot/result/raw/inventory路径均不存在才能消费一次窗口。60秒从入口hash开始，覆盖自动证据、清理、result持久化与CLI；同步OS IO不可硬抢占，超界诚实失败。人工review/Git在时钟外、实际bytes仍占tail。2MiB总额包含prepared、capture和raw磁盘副本双计、全部可见自有编译产物及32KiB receipt/CLI、128KiB人工归档；新input精确预扣准备值，归档预留足够余量。

[局部检查](checks/selected-result.json)实际16通过/31未选（3新+13直接消费者）；Node24惰性import0、3语法0。零目标验证仅用既有fake command/自有临时文件，检查固定选择、唯一profile差异、原C相等、两case/regularfd及旧预算/cleanup直接消费者；Node24惰性import与语法检查不调用显式窗口入口。新片不重复旧实际诊断。技能沿本地find-skills→brainstorming（bounded、GO已明确选择与授权准备）/codebase-design/clean-code；sickn33固定bdacd76，复用单一生命周期、命名与unknown不变，无安装。
