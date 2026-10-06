# O07 原生图工具接入

创建/更新：2026-10-06；状态 in-progress；父产品 O01/U11。唯一owner assignment_review / gpt-6-astra。

目标：把已审O06 graph grant接现O04 Claude SDK循环，以受限MCP read/propose/apply记录图，并沿既有durable outbox保存实际final正文。独立goal-graph-tools profile/internalpurpose，旧node grant不扩权，普通submit/conversation拒绝专属profile。仅两个SDK MCP工具，空工程材料，禁止工程读写/terminal/Web/child。新增019前进迁移，不碰018。

分阶段：第一阶段20literal scope，[claim](../../docs/evidence/o07/claim-receipt.json)；apps/server/src/runners.ts 与 packages/contracts/src/runner.ts由K02先写，未handoff前本owner不修改。其余MCP/profile/domain独立推进，真实claim接缝后amend再接。基于已审组合45b720，非main事实。

- [ ] O07-01 合同、plan/status/review、精确领取。
- [ ] O07-02 独立graph MCP/host capability与profile/domain实现。
- [ ] O07-03 接收claim字段handoff，复用现runtime/query挂载。
- [ ] O07-04 0模型真实MCP→HTTP/PG及生产adapter query注入、升级/拒绝/取消证据。
- [ ] O07-05 clean-code、固定交付/独立review。

确定性验收：空项目发布说明三步，scope baseRevision1/allowedExistingNodes=[]/maxProposals1/maxApplications1/maxNewNodes3/maxNewEdges2。read空底稿→一次propose→apply→实际synthetic final持久化；图3nodes/2edges且taskId均null，不执行child。同key复用、不假称已执行发布。SDK0.3.290与现依赖不升级，不重写agent loop/授权状态机。纯handler测试不能冒充完整接入。

真实模型候选最多1query/4turns/$0.20/90s尚未获执行授权，本任务0模型/云/认证网络/现服务操作。完整自然语言规划与语义验收仍open。共享client/exports/serverindex由Lead接线。
