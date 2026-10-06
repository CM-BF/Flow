# COST01A — 可解释任务用量读口

状态：in-progress。创建/更新：2026-10-06。所属大task：[COST-001](../../../execution-cost/plans/cost01-execution-cost/plan.md)；co-lead：Execution Lead。

在既有 task/usage_samples 权威账本上提供一个 owner 轻读口，解释输入、缓存读取、缓存写入、输出与 SDK 估价。旧 UsageTotals 原样保留；缺测、缺基线、来源版本未知不补零。无新账本、迁移、预算状态机或 provider 调用。

## Module / Interface

- `usage-readout` 只读已存数值与身份元数据，不取 prompt、工具或助手正文。内部使用既有累计基线规则；必要纯函数提取由合法 scope 协调后实施。
- `GET /api/tasks/:id/usage-readout`：owner 授权，单任务，no-store；固定有界样本和来源数量。超界明确返回覆盖缺口，不能把已读子集冒充完整任务。
- 旧 totals 是现有累计事实；新缓存投影区分已知小计和完整值。来源版本若未持久记录始终 unknown，模型名不推断 planner/reviewer/子agent等阶段。
- 资源由传入 Pool 与现有 server 拥有，无后台循环；读取用同一 RR 事务一致观察，不声称永久快照。

## TODO

- [x] COST01A-01：固定字段口径、原始数值核对和小 Interface。
- [x] COST01A-02：有界只读投影与公开 HTTP 路由，复用唯一基线规则。
- [x] COST01A-03：真实隔离 PG/HTTP 的去重、累计差分、unknown、授权、无正文和字节界限验证。
- [ ] COST01A-04：clean-code、固定原始证据、独立 review 与 main 接收。

## 已授权边界与后继

本片只覆盖任务用量解释。源外辅助调用、阶段归因、全局并发预算、订阅账单与三端 UI 仍由 COST-001 后继验收；Codex 未获权威用量策略时保持未知，不套用 Claude 的缓存相加规则。无实际模型调用。

复用[根模块化规则](../../AGENTS.md#modular-design)。公开 HTTP/真实 PG 是已授权测试 seam；不因技能流程重复请求普通实现许可。磁盘共享 reserve 至少 1 GiB；依赖只复用现存固定版本，拒绝大安装。
