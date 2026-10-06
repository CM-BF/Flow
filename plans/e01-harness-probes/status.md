# E01 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新时间 | 2026-10-06 03:10 UTC |
| 单一 status owner / model | runner_owner / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/harness-auth-probes |
| Branch | codex/harness-auth-probes |
| 工作基线 / HEAD | base b5b4ce21bd8ae5e0fd729c526226e8f8a49a7a47；最新实现db2f2d0f6c2b0db3cab454d6cfe617b4671196b1；auth固定8e232a0c2f52fd08565c2d377215c9d3a8904641 |
| 工作树 dirty 状态 | 两片段源码已冻结；本次仅最终证据和计划metadata，提交后clean |
| 工作分支状态 | completed（两项合成探针）；Paseo待独立review |
| 检查状态 | PASSED db2f2d0f6c2b0db3cab454d6cfe617b4671196b1；Paseo真实合成进程/decoder约0.214s、2个MJS语法/hash/diffcheck；auth原9场景与3个MJS证据保留且源码无差异；不是上游可靠性通过 |
| Review | NOT_STARTED（Paseo db2f2d0f6c2b0db3cab454d6cfe617b4671196b1）；auth APPROVED 8e232a0c2f52fd08565c2d377215c9d3a8904641，Goal Owner只读方法审查 |
| 已集成 main 状态 / HEAD | 本实验未集成；基线 b5b4ce21bd8ae5e0fd729c526226e8f8a49a7a47；无产品功能修改 |
| 阶段 | M2 |
| 优先级 | 3 |
| 当前产出 | auth观察已审通过，RPC字节流与退出观察已交付 |
| 下一可用交付 | Paseo观察独立审查与复用边界确认 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| 实现目标 | db2f2d0f6c2b0db3cab454d6cfe617b4671196b1 |
| 实现范围 | experiments/harness-probes/auth/, experiments/harness-probes/paseo/ |

| TODO ID | 状态 | Owner | 证据 |
| --- | --- | --- | --- |
| E01-01 | completed | runner_owner | 1.0.143/1.0.139、Apache-2.0、doStart→resolver→store→refresh→write，原文hash已核验 |
| E01-02 | completed | runner_owner | 9场景1.49s、raw JSON 44,974B，0真实刷新/Keychain/模型 |
| E01-03 | completed | runner_owner | 固定target、复跑命令/注入差异/风险/clean-code；Goal Owner auth只读review APPROVED，未重跑 |
| E01-04 | completed | runner_owner | 固定7a30305原文/许可/hash、真实合成Node pipes与decoder4项观察，raw/限制已保存；本项review NOT_STARTED |

唯一状态源；已通知 Lead 工作树与 scope，尚未亲自核验看板登记。claim 4c525d50-50a4-4bf4-83be-4f978b601b1d v1 active，交付/review期保留。0模型/云；R02真实预算5/5不动。首片段不代表上游整体可靠性、OS沙箱或产品集成。

[原始结果与限制](../../docs/evidence/e01/README.md)：同PID2/16调用重复旧刷新token；受控共享tmp交错产生ENOENT，16调用样本返回值/文件值不一致；调用者取消150ms后helper仍pending，父watchdog结束，fetch注入的deadline/cancel可退出。不能把受控调度当自然发生率，也不能声称真实登录已修复。

Goal Owner独立读完整auth run/runtime/worker、README/provenance、上游helper与结果，10份复制源码/license hash和raw bb7d3f9吻合，APPROVED固定8e232a0，无blocking，未重跑。Paseo新源码不继承该批准；新raw a123e8e560f595bf12b1bc26d771c2699c1debc27f85c9e2c4bb032368d52c7a，与auth文件独立保存。
