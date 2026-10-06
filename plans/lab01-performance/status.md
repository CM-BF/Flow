# LAB01 状态

- 更新时间 / main同步核验：2026-10-06 01:29 UTC；单一 owner/model：assignment_review / gpt-6-astra。
- 仓库：Flow；worktree：`/Users/citrine/Projects/AgentHarness/Flow-worktrees/performance-probes`；branch：`codex/performance-probes`。
- Base / 核验HEAD：`5bdb7fa293ebd0d13515fe367f004687927f1897`；dirty：本次实验、证据与计划尚待提交。
- 工作分支：两个vanilla样例、80正式样本+8预热、四张截图与报告完成。main核验 `0763d4653264b09ddd355c292fc8bd88dfc3c584`，LAB01未集成。
- Review target：待本次实现提交；review：NOT_STARTED；[plan](plan.md)、[review](review.md)。

| TODO | 状态 | Owner | 证据 |
| --- | --- | --- | --- |
| LAB01-01 | completed | assignment_review | 全部timeline身份/正文摘要、展开SHA、8192事件/128最终状态/实际DOM一致 |
| LAB01-02 | completed | assignment_review | [原始数据](../../docs/evidence/lab01/results.json) 每策略20有效样本；[重算](../../docs/evidence/lab01/checks.json) p50/p95与源码摘要一致 |
| LAB01-03 | completed | assignment_review | desktop/narrow×浅深四图已逐一查看，无横向溢出；[报告与图](../../docs/evidence/lab01/README.md) |
| LAB01-04 | in-progress | assignment_review | clean-code、语法、源码摘要、分位数、相对链接检查通过；提交交付与独立review待完成 |

## 检查与边界

Node24.20.0 / Playwright1.63.0 / 本机Chrome154.0.8037.98，实际M3 Max。浏览器缓存缺失后转用已有Chrome，无下载。0模型、0云，首次smoke+正式benchmark约6.123秒、最长样本168.02ms；API未压缩累计6,482,225B。代码/证据/计划共约1.18MB，低于64MiB。

A完整gzip正文199819B，按需timeline476B，展开一条后6795B，多一次请求；字节不能当LLM tokens。B DOM变更8192→1024；completion p50 1.4→116.8ms，控制排队代理3.5→2.1ms，两策略均0长任务，此负载未暴露瓶颈。不是INP/实际paint/React/产品性能，未测真实128模型并发。小于时钟步长0.1ms的数值不解释为免费。

find-skills本地优先，实际读用codebase-design、clean-code、frontend-design、webapp-testing，来源摘要与应用记录在报告。可选playwright-cli只查询版本，未安装/未做smoke；完整a11y和其他机器/浏览器未验证。无阻塞。

## 下一步 / handoff / dashboard

提交后将固定SHA交Execution Lead独立只读review，未批准不标通过；不合并main。全局索引由lead维护。本status是本任务唯一手填进度源，等待D01按此权威worktree聚合，尚未核验dashboard展示。
