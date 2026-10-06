# B01 独立 review

状态：NOT_STARTED。空模板不构成通过。

Target：B01-01测量方法和B01-04 workspace局部实现；base edee6b1c5d74c2ee46ec98bab2844579db6a00c4；head 70af7b45814d5ed31d9638649512358e1a0a834b（已向mika请求独立review）。Reviewer：mika（只读），owner b01_bounded_reads 修复。

重点检查每task row-lock提交顺序→投影前缀→索引cursor安全链；不能替换为全局source高水位。8项功能owner证据不替代独立review。

验收：真实 center/专用 PG/动态端口；字节、批次、详情分离与分页行为；原始样本与冷热边界；长历史解释不外推模型容量；失败、退出码和清理状态；变更不超 claim。

可复制审查任务：先核 /Users/citrine/Projects/AgentHarness/Flow-worktrees/bounded-read-performance 的 branch/base/head/dirty 与 receipt，读取 plan/status、实现 diff 和 docs/evidence/b01；只读审查公开 Interface 测量与资源生命周期。按 README 命令独立运行独占临时数据库短测，记录运行 head、实际断言/样本/退出码与未执行项；findings 交 owner 修复，不直接改实现。

| 检查 | 状态 | 证据 |
| --- | --- | --- |
| 方法与实现 | 未执行 | 无 |
| 独立复跑 | 未执行 | 无 |

| ID | Severity | Blocking | 发现 | Owner回应 | 修复commit | 复审 |
| --- | --- | --- | --- | --- | --- | --- |
| 未审查 | 未评估 | 未评估 | 无结论 | 待回应 | 无 | 未执行 |

结论：NOT_STARTED；限制：全部独立检查尚未执行。
