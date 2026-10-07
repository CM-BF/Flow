# SVC08 — 个人 Web 连接生命周期

所属大task：[FLOW-001](../../../plan-status-review/plans/flow-001-architecture/plan.md)；原 REQ19；co-lead：Execution Lead。
状态：completed（仅SVC08限定proxy终结片；个人部署/根因/长期稳定性不在本片完成范围）。只修有因果证据的连接生命周期，不调整64容量或定时重启，不操作个人服务。

- [x] SVC08-01 固定来源、独立树、claim及最小连接实验Interface。
- [x] SVC08-02 正常/首帧后上游FIN/RST的有界真实loopback对照与完整清理。
- [x] SVC08-03 若反例成立，最小职责修复及直接回归；未复现如实保留，不强行改产品。
- [x] SVC08-04 固定源/原证据、独立审查与受控main接收。

设计遵循[根模块规则](../../AGENTS.md#modular-design)，详细[Interface](../../docs/evidence/svc08/interface.md)。个人64CLOSED并不等于Node计数，旧133次churn不复现；本实验不声称个人根因。

一个本队局部段：单轮≤10s/raw64KiB/tmp1MiB/≤6请求；如有因果修复可累计≤30s/raw192KiB/tmp3MiB/≤18请求。fresh≥1GiB+4MiB，保现有合计资源门槛。只自有loopback/组，0PG/Chrome/provider/安装/build。复用OPS14，不复制监督状态机；失败与cleanup分别保存，unknown KEEP。
