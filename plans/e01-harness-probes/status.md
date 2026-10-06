# E01 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新时间 | 2026-10-06 06:53:51 UTC |
| 单一 status owner / model | runner_owner / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/harness-auth-probes |
| Branch | codex/harness-auth-probes |
| 工作基线 / HEAD | base b5b4ce21bd8ae5e0fd729c526226e8f8a49a7a47；最新实现db2f2d0f6c2b0db3cab454d6cfe617b4671196b1；auth固定8e232a0c2f52fd08565c2d377215c9d3a8904641 |
| 工作树 dirty 状态 | 两片段源码已冻结；仅主线接收与停止持有metadata，提交后clean |
| 工作分支状态 | completed（两项已审合成探针；工程能力/真实对照后继未完成） |
| 检查状态 | PASSED db2f2d0f6c2b0db3cab454d6cfe617b4671196b1；Paseo真实合成进程/decoder约0.214s、2个MJS语法/hash/diffcheck；auth原9场景与3个MJS证据保留且源码无差异；不是上游可靠性通过 |
| Review | APPROVED db2f2d0f6c2b0db3cab454d6cfe617b4671196b1（Paseo）；auth APPROVED 8e232a0c2f52fd08565c2d377215c9d3a8904641，Goal Owner只读方法审查 |
| 已集成 main 状态 / HEAD | 已集成；2026-10-06 06:53:51 UTC核main/origin 07b7e5bdbd8c9f68e8e7de7e13a03d60f948999a：auth8e232a0、Paseodb2f2d0均为祖先，各实验范围零diff；不代表生产采用 |
| 阶段 | M2 |
| 本片段交付阶段 | delivered |
| 优先级 | 3 |
| 当前产出 | 认证与消息传输的合成观察已审查并归档 |
| 下一可用交付 | 本片段已交付；工程能力和真实对照保留后续独立任务 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| 实现目标 | db2f2d0f6c2b0db3cab454d6cfe617b4671196b1 |
| 实现范围 | experiments/harness-probes/auth/, experiments/harness-probes/paseo/ |

| TODO ID | 状态 | Owner | 证据 |
| --- | --- | --- | --- |
| E01-01 | completed | runner_owner | 1.0.143/1.0.139、Apache-2.0、doStart→resolver→store→refresh→write，原文hash已核验 |
| E01-02 | completed | runner_owner | 9场景1.49s、raw JSON 44,974B，0真实刷新/Keychain/模型 |
| E01-03 | completed | runner_owner | 固定target、复跑命令/注入差异/风险/clean-code；Goal Owner auth只读review APPROVED，未重跑 |
| E01-04 | completed | runner_owner | 固定7a30305原文/许可/hash、真实合成Node pipes与decoder4项观察，raw/限制已保存；Goal Owner 只读方法 review APPROVED，未重跑 |
| E01-05 | completed | runner_owner | 固定源码与官方资料核对；2-query对照提案已写，未执行 |
| E01-06 | pending | runner_owner | Goal Owner允许0模型兼容/参数预检；真实调用明确未批准，不继承旧5/5预算 |

唯一状态源；canonical已由Lead登记。2026-10-06 06:53 UTC fresh账本核claim 4c525d50-50a4-4bf4-83be-4f978b601b1d v1仍归本owner；无当前修复，已停止实验源码写入。本次metadata提交后执行release，实际外部回执保存于 `/tmp/flow-e01-release-receipt.json`；未来预检/真实对照需新领取，不保持历史范围占用。0模型/云；R02真实预算5/5不动。首片段不代表上游整体可靠性、OS沙箱或产品集成。

[原始结果与限制](../../docs/evidence/e01/README.md)：同PID2/16调用重复旧刷新token；受控共享tmp交错产生ENOENT，16调用样本返回值/文件值不一致；调用者取消150ms后helper仍pending，父watchdog结束，fetch注入的deadline/cancel可退出。不能把受控调度当自然发生率，也不能声称真实登录已修复。

Goal Owner独立读完整auth run/runtime/worker、README/provenance、上游helper与结果，10份复制源码/license hash和raw bb7d3f9吻合，APPROVED固定8e232a0，无blocking，未重跑。Paseo另获Goal Owner独立APPROVED db2f2d0（未重跑），确认原文/许可、raw及测量边界；采用前须修streaming UTF8/字节上限/脱敏。新raw a123e8e560f595bf12b1bc26d771c2699c1debc27f85c9e2c4bb032368d52c7a，与auth文件独立保存。

[真实对照提案](native-wrapper-proposal.md) 已按 Goal Owner 经 Lead 的审定重写：先原生受控工程能力，再 stock wrapper 同类兼容性；原生0.3.290与stock0.3.281差异是选型事实，不宣称严格公平胜负。不以auth/bootstrap/budget/cancel/settings/toolgate/usage组合改造构造另一harness；实际最小补丁须另记。2query/USD2仅待执行预算，当前批准0次；临时合成写模型门槛不自行豁免。

2026-10-06 06:53:51 UTC 管理收尾：只读核已审目标的main祖先和实验路径树相等，未重跑/未读真实凭据/未新增模型。E01-06保持pending，2query/USD2提案仍未生效；原auth/Paseo原始结果与许可/hash不改。clean-code仅检查当前事实/历史限制/TODO一致性；无当前工程修复占用。
