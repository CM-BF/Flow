# E01 独立审查

最新片段状态：APPROVED（Paseo，独立方法审查）。Target：db2f2d0f6c2b0db3cab454d6cfe617b4671196b1。Base：b5b4ce21bd8ae5e0fd729c526226e8f8a49a7a47；branch codex/harness-auth-probes。最新已审范围：experiments/harness-probes/paseo/；唯一writer runner_owner / gpt-6-astra。

auth固定target 8e232a0c2f52fd08565c2d377215c9d3a8904641 / experiments/harness-probes/auth/ 已独立 APPROVED，不能由此批准新增Paseo内容。

## 可复制任务

先核对实际 worktree / HEAD / dirty 与 AGENTS、plan/status。只读验证 experiments/harness-probes/auth 的复制上游源码与 provenance hash/许可、隔离注入、案例/观察是否支持结论。检查没有默认凭据路径、真实 Keychain/网络/模型调用；父进程超时和资源清理有效，受控文件调度不冒充实际生产发生率。检查证据目标与源码一致、复跑命令明确；发现给出位置/severity，修复交 owner，不修改本树。

上述任务说明为auth原审范围。Paseo新片段应只读核对固定源码/许可/hash、真正合成Node child/pipes、跨UTF8 byte chunk、无newline 2MiB观察、exit pending拒绝、stderr尾部/合成marker、独立进程组超时清理，以及未测tree-kill/V2/真实CLI/模型边界。本项已由 Goal Owner 完成以下独立只读方法审查，不以 auth 批准代替。

作者检查：固定源码上9个场景全部完成观察断言（1.49秒），3个MJS语法检查与原文/hash对照通过，源commit diffcheck通过；[raw及报告](../../docs/evidence/e01/README.md)。只证明合成探针测得这些边界，不代表上游生产可靠性。新修复须独立绑定新target，不改写原始JSON；如复跑必须使用新输出路径。

## auth 独立结论

Goal Owner / gpt-6-astra，结论经Execution Lead回传，唯一owner于2026-10-06 03:10 UTC记录：APPROVED target8e232a0c2f52fd08565c2d377215c9d3a8904641。完整阅读run/runtime/worker、README/provenance、上游helper与结果；10个复制文件/license hash一致、raw bb7d3f9ba09b354cab5a517c7211959b9b2267d0160594ecf7e7698b3bacee68及9场景吻合，无blocking，未重跑。批准仅固定版本合成policy/barrier、0模型/真实credential/network方法，不证明实际provider policy、故障频率、跨进程或SDK完整启动。

## Paseo 作者交付

db2f2d0f6c2b0db3cab454d6cfe617b4671196b1：约0.214秒真实合成进程/decoder观察，2个MJS语法检查、逐字Git固定commit/hash与diffcheck通过。raw a123e8e560f595bf12b1bc26d771c2699c1debc27f85c9e2c4bb032368d52c7a。源码目标到最终metadata应零差异；独立结论见下节。

## Paseo 独立结论

Goal Owner / gpt-6-astra，结论经 Execution Lead 回传，唯一 owner 于 2026-10-06 03:14 UTC 记录：APPROVED target db2f2d0f6c2b0db3cab454d6cfe617b4671196b1。完整读取 probe/fixture/RPC/decoder，3份原文/license 对应上游 7a30305503c600bc46ea2a94a6750eac5cede278，raw a123e8e560f595bf12b1bc26d771c2699c1debc27f85c9e2c4bb032368d52c7a 一致，无 blocking，未重跑。确认真实分片 UTF8 损坏、2MiB 暂存（非任意无界证明）、exit7 双 pending 拒绝、8192 字符 stderr 合成 marker 未脱敏；VM/shim/无真实 CLI/V2 等限制清楚。批准的是探针方法与观察，不是上游可直接生产采用；采用前须修 streaming UTF8、按字节限制与日志脱敏。

## 工程对照提案（独立于上述批准）

[native-wrapper-proposal.md](native-wrapper-proposal.md) 为待审新预算/方法提案，当前 PROPOSED；Goal Owner 对 auth/Paseo 的 APPROVED 不授权真实模型调用，也不批准未实现的 adapted wrapper。预检、实现和真实结果须各自固定新 target 与检查证据。
