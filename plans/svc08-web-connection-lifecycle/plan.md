# SVC08 — 个人 Web 连接生命周期

所属大task：[FLOW-001](../../../plan-status-review/plans/flow-001-architecture/plan.md)；原 REQ19；co-lead：Execution Lead。
状态：in-progress（原SVC08限定proxy终结片已于2026-10-07T03:17:28.292Z完成；同锁替换与Web独立来源选择均已main，后继合法Flow产物候选已准备，实际部署/根因/长期稳定性未完成）。只修有因果证据的连接生命周期，不调整64容量或定时重启，不操作个人服务。

- [x] SVC08-01 固定来源、独立树、claim及最小连接实验Interface。
- [x] SVC08-02 正常/首帧后上游FIN/RST的有界真实loopback对照与完整清理。
- [x] SVC08-03 若反例成立，最小职责修复及直接回归；未复现如实保留，不强行改产品。
- [x] SVC08-04 固定源/原证据、独立审查与受控main接收。

设计遵循[根模块规则](../../AGENTS.md#modular-design)，详细[Interface](../../docs/evidence/svc08/interface.md)。个人64CLOSED并不等于Node计数，旧133次churn不复现；本实验不声称个人根因。

一个本队局部段：单轮≤10s/raw64KiB/tmp1MiB/≤6请求；如有因果修复可累计≤30s/raw192KiB/tmp3MiB/≤18请求。fresh≥1GiB+4MiB，保现有合计资源门槛。只自有loopback/组，0PG/Chrome/provider/安装/build。复用OPS14，不复制监督状态机；失败与cleanup分别保存，unknown KEEP。

- [x] SVC08-05 固定Web-only宿主替换候选及retained3明确退役/回退设计；仅新docs claim。
- [x] SVC08-06 同锁受管替换与自有故障验证完成限定独审及main2f18；不代表个人部署。

后继准备于2026-10-07T03:29:12.051Z实际开始；原产品claim已released。SVC06于03:39:40.263Z移出四产品路径；本owner03:40:29.530Z amend v2后合法实施。本片局部段≤60s/16MiB，0PG/Chrome/provider/个人动作，复用OPS14。

- [x] SVC08-07 Web-only固定host选择、角色授权与同journal恢复边界；五新+四直接用例分轮完成，限定独审与main422接收。
- [ ] SVC08-08 合法Flow来源真实host artifact、内部子进程/依赖/旧后台动态读取证明与受管个人部署观察；retained3退役仍后继，不自动执行。
