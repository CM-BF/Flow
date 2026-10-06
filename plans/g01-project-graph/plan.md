# G01 持久项目与版本化计划图

创建 / 更新：2026-10-06。状态：in-progress。Owner：runner_owner / gpt-6-astra。

## 首片段目标与授权

按 Execution Lead 明确授权，交付持久 personal Workspace、Project revision CAS、版本化子任务节点和依赖命令、原子无环验证。此为新 domain 的 architectural 片段；用户已授权该方向/实现，沿用本地 brainstorming 的设计审查方法，不为已授权普通实现重复请求批准。设计与 Interface 已向 Lead 发送并获接受。

首片段只维护计划图和显式已有 Flow task 关联。未绑定节点 taskId=null 必须可先规划依赖；不自动提交/调度，不修改现有 task 状态。后续依赖 gate、版本失效决策、取消传播仍 open，不声称完整 O01。

## 方案与 Interface

单项目行锁保护 revision CAS 与有界图的整体验证；不同项目不共用图锁。每次成功命令新增 immutable graph revision 和变更原因，节点各自 version。事务内保留父子树和依赖图两个无环约束；不将父子关系暗中转成执行依赖。子节点增/移带 parent version，修改/删除带 node version；整体命令带 expectedRevision。

- GET /api/workspaces：持久 personal workspace；不宣称多租户。
- POST /api/projects，GET /api/projects（workspaceId、after、limit），GET /api/projects/:id（可选 revision）。
- POST /api/projects/:id/commands：add-node、update-node、bind-task、reparent-node、set-dependencies、remove-node。均需 Idempotency-Key 与 reason。
- 删除有子节点或被依赖的节点直接拒绝，不静默截断。task 只能属于一个当前节点；已有绑定不可静默换 task，执行状态仅从 tasks 查询。
- 最大 200 节点 / 2000 依赖边；历史 revision 精确查询，不做无界展开。HTTP owner 权限继承中心，runner 不可访问。

外部 seam：registerProjectRoutes(app,pool) 与 migrateProjects(pool)，用于中心接线和真实 HTTP/PG 测试。共享 index/client/server index/database 入口由 Lead 单写；本 owner 只提供新 contracts/projects.ts 和独占模块。

## TODO 与验收

- [ ] G01-T01 冻结小合同、设计与迁移 seam，交 Lead 提前接线。
- [ ] G01-T02 纵向 red→green：持久创建/查询、幂等命令与双事务相反依赖，至少一个 409；刷新后循环仍拒绝。
- [ ] G01-T03 父/子/项目版本拒绝、跨图/重复 task、树循环/依赖循环与被引用删除拒绝；历史/重启/鉴权及不同项目不共用图锁；标明后续调度缺口。

写入范围：packages/contracts/src/projects.ts、apps/server/src/projects/**、packages/storage/migrations/004-projects.sql、此计划、docs/evidence/g01/**、docs/architecture/g01-projects.md。专用 flow_g01，动态端口，0 模型 / 云。全局索引和集成由 Lead 管理。
