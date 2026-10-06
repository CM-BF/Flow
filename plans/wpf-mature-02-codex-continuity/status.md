# MATURE02C02 状态

| 字段 | 当前事实 |
| --- | --- |
| task ID | MATURE02C02 |
| 层级 | 子task |
| 所属大task | [WPF-MATURE-02](/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-codex-capabilities/plans/wpf-mature-02-harness-capabilities/plan.md) |
| co-lead | mika |
| owner / model | chatui01_owner / gpt-6-astra |
| 更新时间 | 2026-10-06T21:24:21.636907+00:00 |
| 阶段 | M2 |
| 优先级 | 2 |
| 本片段交付阶段 | implementation |
| 当前产出 | 已实现明确授权的持久会话接口；注入两轮能关闭并恢复同一会话，正在完成兼容检查和公开任务链路。 |
| 下一可用交付 | 两轮独立执行复用同一自有会话存储的公开任务接口。 |
| 当前阻塞 | 直接检查发现旧测试的通知时序不确定，正在收束可重复反例；真实 PG/native 窗口未开放。 |
| 需用户决定 | NONE |
| worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/codex-conversation-continuity |
| branch | codex/codex-conversation-continuity |
| base / 写入前HEAD | eae85567ba5dfb650ba71b473917130f87b5945c |
| dirty | 产品与直接测试草稿 dirty，待固定 checkpoint；历史raw不回写。 |
| claim | 8ad6536b-1194-44a4-9078-a92215bec7a2 v1 ACTIVE，20 literal，COMMITTED 2026-10-06T21:04:11.126Z |
| 实现目标 | 未产生产品实现 commit |
| 实现范围 | 见 [claim-receipt.json](../../docs/evidence/mature02c02/claim-receipt.json) 的20条精确scope |
| Review | NOT_STARTED；方向已获 mika 接受，尚非源码/验证批准。 |
| 检查 | 合同red 1/3；首5文件log 50/53，fixture时间戳修后定向7/7、exit0。直接consumer65/66、exit1；类型检查有1个fixture推断诊断，已窄修待复核。0PG/Codex/provider/install。 |
| main集成 | NOT_INTEGRATED；基线 eae85567ba5dfb650ba71b473917130f87b5945c |
| Dashboard | 唯一 status 已建立，等待 Execution Lead 登记本来源；未触发聚合轮询。 |
| 架构影响 | 私有持久存储绑定与单 exchange 的 start/resume 选择；具体实现待固定后登记图更新 target。 |

| TODO | 状态 | 证据/剩余边界 |
| --- | --- | --- |
| C02-01 | in-progress | [Interface](../../docs/evidence/mature02c02/interface.md)，已实现；新contract/storage反例通过记录见 checks，旧目录真实PG待窗口 |
| C02-02 | in-progress | 原单FSM start/resume，7项注入通过；旧post-terminal直接consumer反例收束中 |
| C02-03 | pending | public API专库窗口未开放，注入不代表真实native恢复 |
| C02-04 | pending | R05D main/config/launch尚需trusted factory/storage接线；evidence.ts还需固定0.154 global remote-status严格分类，均未领取/未改。真实两轮另排 |
| C02-05 | pending | 目录协商/client、conversations小harness policy与增量migration、Web/TUI未领取；state/replies须消费REQ15批量Interface |

供给唯一入口：[source-request](../../docs/evidence/mature02c02/source-request.json)，291项1548050逻辑B；
依赖：[dependency-link-request](../../docs/evidence/mature02c02/dependency-link-request.json)，17已装第三方+3本树@flow，只请求20个ignored links。供给回执已归档 source-provision-receipt.json；owner未安装或自行物化。

检查原件：contract-red-*、continuity-first-*、continuity-green-*、direct-consumers-*、focused-types-first-*。首5文件收据退出码误用日志推断，独立 continuity-first-correction.json 将实际进程退出码标UNKNOWN；50pass只引用Vitest报告，未声称整组成功。
