# 整项目Codex诊断阻塞：v2已审候选的新窗口请求

**状态：WAITING_GO_RUN_BUDGET；当前v2运行授权NONE。** 本文仅向GO路由一项新的固定候选预算请求，不运行。旧窗口mika-c-fd-20261006-110819已消费并以6d1d9758封存FAIL/0target，不能补跑；旧11679B stderr没有保存，仍不能确定失败原因。

**已完成独审：** Mika/gpt-6-astra，2026-10-06 11:20:49 UTC，APPROVED，0 P1/P2。固定target `851fd8c7a48b6ebec64cbf80ccda4eb6bcfaf845`；runtime source `391f67b42d4ec272ec679a33c0812517afd69090`。37 current+5 unchanged+38 old+6 external及prepared104454B逐Git/WT/hash/bytes一致；26/26受影响检查、9未选，实际新增编译/目标0，reviewer未重跑。原始编译流先于health/parser以0600/wx/fsync保留、磁盘副本计入同预算、固定阶段/类别、LLVM纯数据词法与原cleanup边界均获批准。

**申请：一次新1 compile call、最多3 synthetic C targets、单一60秒、2MiB。** clock从入口hash前起，涵盖compile/run/cleanup/result persistence/CLI；2MiB含prepared104454B、原流capture与持久副本、所有自有可见编译产物/报告、32KiB运行收据池及128KiB实际安全归档尾部。编译/任一目标失败、unknown、越界立即停，未运行者NOT_RUN；不重试、不换目录或恢复旧clock。具体矩阵仍控制socket→同profile socket→同profile三个自有file，仅测自己的fstat/fcntl。

**本候选可提供的新信息：** 将固定自有C编译原stdout/stderr各≤64KiB持久到有限证据文件，并报告失败阶段/有限类别；能区分后继解析/产物检查失败，而不再只剩opaque failure。保留unknown，不跳过固定exe/owned输出、健康状态或清理检查；官方lexer改善不等于已定位旧失败。

**固定输入与recipe：** [README](README.md)、[manifest](manifest.json) SHA `224b101fe787ac331507550ea530b4cf6ef1057d836ced71f02700f0b24b4cda`；[driver-input](driver-input.json) SHA `0b4ca46c82273e88c527ab79e3a35c3e8053180b8221e59c961d243ebd5bea96`。权威WT `/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-codex-capabilities`，branch codex/claude-codex-capabilities，claim0dd97484 v4 ACTIVE。准备本回执前已核完整clean metadata HEAD `3aeff11bd69822cf653a475d8a210494cd15fe0d`；本次仅新增批准/request metadata，最终clean提交由owner回执交Mika。GO批准预算之后，仍由Mika绑定那个完整HEAD与唯一窗口名，禁止直接运行移动branch HEAD。

唯一候选调用（当前不得执行）：

```sh
/opt/homebrew/opt/node@24/bin/node experiments/codex-app-server-conformance/fd-canary/execute-reviewed.mjs --reviewed-fd-window-v2
```

原C/profile/权限、command/R06不扩，无真实Codex/SDK/provider/auth、无网络探针、无账户/凭据/crash读取。仍只自有两个临时root与固定工具链；原始流不console回显或送产品日志。GO批准后Mika再命名单次窗口；未批准前仅持有已审候选，停止实际诊断与进一步发散研究。既有R06/薄consumer可独立集成，不把本阻塞扩成其他交付阻塞。
