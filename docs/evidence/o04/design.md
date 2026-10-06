# O04 设计与质量记录

2026-10-06T04:46:04Z Node24/TS/PG/固定ClaudeSDK0.3.290 stack，find-skills本地优先，实际读用 /Users/citrine/.agents/skills/{find-skills,codebase-design,clean-code,tdd,brainstorming}/SKILL.md。clean-code来源sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5。沿已有本地技能，无重装；Root/Lead已批准bounded方案与seams，不重复审批。深module隐藏runner credential与HTTP准入；不复制agent loop/goal mutation。

配置新增显式access=goal-tools；本机manifest goalTools=true且无material read。新profile通过新runner发布，旧profile不变。center requireExecutionProfile/acceptTask新增仅内部purpose；ordinary不能选择goal-tools，O03 native必须goal-tools。claim仅由持久grant派生非秘密引用，专用runner不领普通任务。013前进扩grant mode，012原文不改。

Host Port封闭固定goal/ownership/grant；无显式input version拒绝。每次调用中心重验且使用signal/timeout。SDK MCP实例沿O02 flow-goal name，正式key选flow-goal，FQ精确mcp__flow-goal__goal_read与goal_command，并以官方MCPpeer实际list核验。tools=[]禁builtins，PreToolUse要求sdk provenance+精确key/工具，未知拒绝。复用typed final/session/usage/artifact/verifier/outbox，不消费thinking/tool为正文。

0模型验证：真实center+PG+runRunner+生产ClaudeAdapter.run，注入query函数取这次实际options的SDK server，用真实官方MCP协议执行，再synthetic init/result经原事件路径入库。证明host接线/协议/事务，不宣称原生SDK子进程或自然语言模型通过。官方参考 https://code.claude.com/docs/en/agent-sdk/custom-tools 与 /permissions；pinned d.ts已读source='sdk'、tools=[]、env替换语义。

2026-10-06T04:56:54Z clean-code交付复核：逐读新增host bridge/policy及claude/configuration/profile/runtime、中心purpose/claim/grant/migration差异。新Interface收拢client/ownership/abort，不暴露token；复用O02与原SDK/outbox/final逻辑，无新loop。错误消息固定，MCP只回center_rejected/outcome_unknown，未知ACK不自动重试。内部purpose默认ordinary，HTTP schema不接受伪造用途。新profile mode必须显式无材料读取；grant不可改。锁序沿O03不变，013只扩mode，无旧grant重写。

发现/修复：首集成测试误用不存在的client.task/assistantMethods，改实际show及公开assistant HTTP；测试submit预期201改真实202；第三synthetic run重复前一个runner的native session导致中心拒绝（正确防线），修独立session identity，不放宽生产归属。共享输入单pick冲突已abort，按Lead授权完整merge dc9；未修改共享冲突。最终77/77（18.96s）+25/25直接runtime消费者（2.03s）+tsc；0模型，无本片段未解决blocking。

限制：query函数被注入，实际MCP server/Client/HTTP/PG与runner循环是真的；未启动原生SDK子进程或验证FQ在原生模型进程中的执行，仅按固定SDK key/name/真实tools list与query options核对。typed final证明native turn文本归属，不代表goal/child交付已验证；child execute只fixture并在本测试保持queued。普通读取仍有O02全snapshot取数/hash；本片段不宣称token/中心性能提升。新native grant不支持resume或C02自动重放，未知外部写仍需显式核对。

2026-10-06T05:05:09Z clean-code补证复核：本地find-skills/codebase-design复用，重新读clean-code/tdd；仅新增migration.test，使用生产迁移/domain/HTTP seams和真实PG，拆分012创建、数据准备、请求与存储快照，无生产逻辑复制、schema降级或新依赖。fixture claim给60s有效租期，仅本测试库；finally关闭本app/boss/pool并删该随机DB。原23源码/20输出hash全一致。单场景+tsc首次通过；无未解决产品finding，等待Root证据复核。
