# O01 技能与质量

2026-10-06 03:07 UTC，Astra。Node24/TypeScript/PostgreSQL，复用本 task stack 的本地优先 discovery；实际重新读取 `/Users/citrine/.agents/skills/find-skills/SKILL.md`、`brainstorming/SKILL.md`、`tdd/SKILL.md`、`codebase-design/SKILL.md`、`clean-code/SKILL.md`。本地技能已匹配，无新增安装。clean-code 固定用户来源 sickn33/agentic-awesome-skills @ bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5；不反复安装。

实际应用：brainstorming 先写已授权可审设计，比较全局 revision 失效与实际 input/dependency binding，选择后者；codebase-design 采用中心 HTTP + 纯受限工具两个公开 seams，存储细节不泄漏给工具；TDD 从真实 HTTP/PG 行为红测开始；clean-code 关注原子命令、窄 schema、明确 unknown/恢复错误、避免另造工作流及复制 G01。

初始发现：G01 node.version 同时包含标题/依赖/绑定变化，不适合作为实际输入版本；独立 node input version 可避免无关项目 revision 全局失效。G01 taskId 单一绑定不适合多次执行，因此 goal executions 独立引用 G01 node 与现有 task，保留全部历史。共享入口由 Lead 单写。

SDK：根锁已固定 @anthropic-ai/claude-agent-sdk 0.3.290，frozen 安装后核验实际 sdk.d.ts:615 的 createSdkMcpServer 及 :9728 的 tool(raw Zod shape, handler) 类型；此段只纯 handler，无 SDK/模型调用。交付前继续记录实际检查、发现、修复与未解决。

2026-10-06 03:11 UTC：公开 HTTP/PG 首轮先红 2/2（缺入口 404），实现后绿 2/2，typecheck PASSED。采用 Lead 授权的 acceptTask(client,boss,input) 小提取，原 submit 的幂等外壳不变，goal 复用同事务受理。D04 claim 已增为 v2 并实际 list 匹配（live 多出的 needsVerification=false 是派生字段）。Root 轻读反馈落实：snapshot 不返回完整 input 或 execution.dependencies，独立 inputs/detail 与历史读取；当前 state 只加载现有至多 200 个节点，已删除历史不膨胀当前查询。

2026-10-06 03:15 UTC，交付前 clean-code：检查 contracts、center commands/state/routes、migration、纯工具和公开接口测试。命名区分 actual input version、project revision 和 artifact binding；共享任务受理只提取一次；状态恢复复用现有 task/C02，不引入调度框架。修复原始 goal/acceptance 的 trim 转换，保留用户原文（包括首尾空白）；修改测试覆盖原文。查询只取当前最多 200 节点，task JSON 投影去掉 prompt；轻读 snapshot 不含 input/依赖内容。错误路径明确 stale/foreign/unverified/uncertain，不静默重试。测试中原 submit 状态码起初误写 201，核对现有公开合同 202 后修正；没有改生产行为。当前 10/10 + typecheck 通过。未解决/限制：内部当前查询仍读取有界实际输入供一致性计算；无真实模型、无 SDK tool mount、无语义验收、无自动重跑。生产挂载由 Lead 单写，尚未在本树实际测试。
