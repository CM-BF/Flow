# E01 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新时间 | 2026-10-06 03:06 UTC |
| 单一 status owner / model | runner_owner / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/harness-auth-probes |
| Branch | codex/harness-auth-probes |
| 工作基线 / HEAD | base b5b4ce21bd8ae5e0fd729c526226e8f8a49a7a47；实现8e232a0c2f52fd08565c2d377215c9d3a8904641，其后仅交付metadata |
| 工作树 dirty 状态 | 实现已冻结；本次提交原始观察与计划metadata，提交后clean |
| 工作分支状态 | completed（首auth探针）；待独立review |
| 检查状态 | PASSED 8e232a0c2f52fd08565c2d377215c9d3a8904641；9个有界合成场景、复制源码字节/hash、3个MJS语法、diffcheck；不是上游可靠性通过 |
| Review | NOT_STARTED |
| 已集成 main 状态 / HEAD | 本实验未集成；基线 b5b4ce21bd8ae5e0fd729c526226e8f8a49a7a47；无产品功能修改 |
| 阶段 | M2 |
| 优先级 | 3 |
| 当前产出 | 已复现上游认证刷新并发与取消边界，结果可复跑 |
| 下一可用交付 | auth观察独立审查；Paseo RPC 可另起小片段 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| 实现目标 | 8e232a0c2f52fd08565c2d377215c9d3a8904641 |
| 实现范围 | experiments/harness-probes/auth/ |

| TODO ID | 状态 | Owner | 证据 |
| --- | --- | --- | --- |
| E01-01 | completed | runner_owner | 1.0.143/1.0.139、Apache-2.0、doStart→resolver→store→refresh→write，原文hash已核验 |
| E01-02 | completed | runner_owner | 9场景1.49s、raw JSON 44,974B，0真实刷新/Keychain/模型 |
| E01-03 | completed | runner_owner | 固定target、复跑命令/注入差异/风险/clean-code记录，独立review NOT_STARTED |

唯一状态源；已通知 Lead 工作树与 scope，尚未亲自核验看板登记。claim 4c525d50-50a4-4bf4-83be-4f978b601b1d v1 active，交付/review期保留。0模型/云；R02真实预算5/5不动。首片段不代表上游整体可靠性、OS沙箱或产品集成。

[原始结果与限制](../../docs/evidence/e01/README.md)：同PID2/16调用重复旧刷新token；受控共享tmp交错产生ENOENT，16调用样本返回值/文件值不一致；调用者取消150ms后helper仍pending，父watchdog结束，fetch注入的deadline/cancel可退出。不能把受控调度当自然发生率，也不能声称真实登录已修复。
