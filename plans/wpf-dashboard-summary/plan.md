# WPF-DASHSUM01 首屏摘要与父子任务下钻

状态：in-progress。创建/更新：2026-10-06 11:44:35 UTC。父任务：[D01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/execution-dashboard/plans/d01-execution-dashboard/plan.md)。co-lead：Web /root。

用户结果：首屏让不同工作方向容易被看到；父任务下可查看已确认直属子任务，技术身份留在详情。唯一事实仍来自各owner status，不合成父进度、阻塞或Done。

已批准Interface：humanOverview只在子任务显式known父关系且父自身current、摘要完整、active时，从active/delivery两个前三候选中略过子任务。优先级只用父自己的事实；其它active和独立blocker/decision/unknown/history保留。public/app复用单弹窗、任务按钮和样式，父详情列known直接children自己的摘要/显式阶段；摘要保留短领取与异常，工作线完整展示沿旧逻辑。

范围：claim六literal见[原始回执](../../docs/evidence/wpf-dashboard-summary/claim-receipt.json)。基线`2c6df4754f4fea75fbb2e1e750cad89524b1f5fa`。不改aggregate/proof/registry/parser/CSS/协调DB，不访问4320或个人服务。

- [x] WPF-DASHSUM01-01：实现确认关系的摘要筛选、精简卡片和父子下钻。
- [x] WPF-DASHSUM01-02：局部行为和真实浏览器验证，保留未知/信号、键盘、浅深390与原证据。
- [ ] WPF-DASHSUM01-03：固定target独立review、正常push与主线接收；未接收不得勾完。

验证：定向Node测试human/task-links/delivery；修改已有task-links浏览器检查以新规则执行原下钻/转义/主题验收，输出只到本证据目录。浏览器累计≤90秒，其中10秒专留清理；1Chrome/临时样本动态端口、0PG/模型、证据≤8MiB。超预算如实停报，不能隐性扩大或删断言。结构质量按[根规则](../../AGENTS.md#modular-design)与[quality](../../docs/evidence/wpf-dashboard-summary/quality.md)。
