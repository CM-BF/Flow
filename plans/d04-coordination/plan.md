# D04 — 多 Lead 领取登记

状态：in-progress。Owner：Execution Lead / Astra Ultra。用户已授权，Goal Owner 已确认 PostgreSQL 方案。

## 目标与方案

领取账本只记录分配，不复制 status 的进度、TODO 或审查。独立 PostgreSQL `flow_coordination` 数据库、`flow_engineering` schema；不触碰产品 migrations。CLI 提交后才发 receipt；看板只读，PG 不可用时短超时返回“领取状态未知”，原有进度仍可读。

同事务工程专用 advisory lock 序列化低频 take/amend/release/handoff。writer 的 task、worktree、literal 父子范围冲突不能双成功；review role 不占 writer 范围。路径规范化按段判断，拒绝绝对路径、..、glob、symlink 范围和含糊写法。稳定 requestId + 相同规范化 payload 重试返回原 receipt，不同 payload 拒绝。receipt 含 claimId/version/lead/worker/worktree/branch/scope/提交确认时间。

active claim 在 review/修复期仍占用。release 或 handoff 必须当前 version 与 owner 身份，明确确认停止写入；handoff_pending 保留范围，新 owner accept 后才可写。amend 原子核对新 scope，失败保留旧范围。陈旧只提示核对，不超时抢占。合作式同机登记不声称 OS 强隔离或远程认证。

集成角色只应用已审提交，不同时重写 feature 逻辑；手工冲突修复/新实现须先与原 owner 协调路径，不能借 integration 绕过冲突。现有合法开工者标记 migration，观察时间不冒充开始时间。

全局标题仅来自明确 FLOW-001 短阶段字段；阶段为共同里程碑（当前 M2），细节保留当前产出/下一交付。

## TODO

- [ ] D04-01：PostgreSQL 原子账本、CLI、receipt 与版本约束。
- [ ] D04-02：真实双 process 冲突/独立范围、丢响应重试、过时版本、handoff/amend 与失败关闭验证。
- [ ] D04-03：只读看板领取展示、短阶段来源与连接超时降级。
- [ ] D04-04：现有 owner 迁移、规则、局部检查、独立 review 和可见服务切换。

## 独占范围与验证

apps/execution-dashboard/、plans/d04-coordination/、docs/evidence/d04/；Lead 单写根依赖锁、根规则/plans规则/模板/索引。与 G01/P02 产品范围分离。Node24/pg8.23.1 已有 stack；局部 Node tests + 专用协调测试 DB + Chrome 明暗窄屏，不跑产品全套。

## Skills

本地 find-skills 发现并读取 codebase-design / clean-code / brainstorming / webapp-testing。实际应用：事务/幂等/冲突隐藏在账本模块，CLI/网页共用读接口；公开行为及两个真实 process 测试；按已获明确授权的设计直接实施，不新增 skill 审批。clean-code 每工作段/交付/合并前；浏览器明确 ready locator，不等 SSE networkidle。
