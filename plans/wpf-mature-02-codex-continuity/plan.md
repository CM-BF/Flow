# MATURE02C02：Codex 会话连续性

状态：in-progress；创建/更新：2026-10-06。所属大task：[WPF-MATURE-02](/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-codex-capabilities/plans/wpf-mature-02-harness-capabilities/plan.md)，追溯 TODO04/06/11；co-lead：mika；owner：chatui01_owner / gpt-6-astra。本目录为同一直接子task，不另建层级。

用户目标是同一会话下一条能够继续上下文，关闭客户端只结束观察，后台执行不因此停止；同 runner 的原生进程关闭后仍能恢复已确认会话。首片交付公开 task API、显式宿主持久配置和注入 transport 的两轮证据；它不替代生产启动器、conversations/Web/TUI 或真实模型验收。

## 已选方案

选择 optional `sessionPersistence: 'host-owned'`，无 default。旧配置序列化/digest 不变，旧 profile 仍不支持 resume。新 profile 由中心 pin 验证；descriptor 从同一字段派生。原 native-v1 目录在 SQL LIMIT 前排除新 opt-in，不剥字段伪造旧配置。新的目录消费属于后继。

可信宿主创建小 storage handle，绑定自有固定目录 identity、runner/config；handle 内的 private factory 真正向每轮 transport 注入固定 codeHome。task/HTTP/profile 不携带 path/env/args/auth。现 guardExecutionProfile、executionIdentity、session fence 是已有权威，不增注册表/授权状态机。每轮 identity 不符在 factory 前拒绝。

现 exchange 单 FSM 增 start/resume 选择：新开始 persistent，恢复仅 threadId 和固定配置，excludeTurns=true；返回 ID 必须一致再 turn/start。未知 ACK/close 不 fallback、不重播。engineering 仍单次 ephemeral start、独立 writer policy。R06 仍唯一 spawn/stdio/关闭 owner。

备选“全部 Codex 默认 resume”会误报旧 ephemeral 会话；备选“先全量生产与 UI”会绑住共享 reader 和运行窗口。已选 opt-in 纵向片有独立验收，完整用户目标继续保留。

## TODO

- [ ] C02-01：固定私有 storage/公开 opt-in/旧目录兼容接口与直接反例。
- [ ] C02-02：扩展原 exchange，严格恢复 ID、unknown 和 engineering 隔离。
- [ ] C02-03：公开 task API 两轮同 runner/session、两个独立 transport 共实际持久 fixture；观察者关闭不取消后台，直接 consumers 检查及独审/main。
- [ ] C02-04：生产 R05D trusted loader/CODEX_HOME 接线与受控实际两轮；真实 auth/model/成本验收另有明确窗口。
- [ ] C02-05：完整 conversations typed/目录/Web/TUI 接线，与 REQ15 共享 owner 协调，交付父计划完整连续性目标。

C02-01～03 是首片；C02-04/05 尚未领取所需新增共享范围，不能用首片通过勾选。现有 20 literal 见 [claim](../../docs/evidence/mature02c02/claim-receipt.json)。

## 验证与资源

先 Node24/Vitest4.0.18 零模型注入检查，再独立申请固定专库/动态端口的 public API 组。源码供给含 30 个已存在 SQL；无新 migration。已绿历史组仅因直接消费者新风险选取，不重跑全集。当前已执行有界合同/注入及直接consumer检查，失败如实保留；0PG/Codex/provider/install。

未知结果保持原 key/session/任务事实；保存会话的宿主目录在两轮之间不删除，退出进程不冒称该目录已销毁。后继真实窗口需固定版本、模型/认证来源、时间、输出/费用边界和同身份清理方案，当前没有真实运行额度。

架构影响：新增私有 storage→factory 边及 exchange 请求选择；R06/中心 session 锁权威不变。实现后由本 owner 在 status 登记图更新 target，Execution Lead 受控同步。方法遵循 [根模块规则](../../AGENTS.md#modular-design)。
