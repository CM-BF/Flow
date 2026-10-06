# O04 设计与质量记录

2026-10-06T04:46:04Z Node24/TS/PG/固定ClaudeSDK0.3.290 stack，find-skills本地优先，实际读用 /Users/citrine/.agents/skills/{find-skills,codebase-design,clean-code,tdd,brainstorming}/SKILL.md。clean-code来源sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5。沿已有本地技能，无重装；Root/Lead已批准bounded方案与seams，不重复审批。深module隐藏runner credential与HTTP准入；不复制agent loop/goal mutation。

配置新增显式access=goal-tools；本机manifest goalTools=true且无material read。新profile通过新runner发布，旧profile不变。center requireExecutionProfile/acceptTask新增仅内部purpose；ordinary不能选择goal-tools，O03 native必须goal-tools。claim仅由持久grant派生非秘密引用，专用runner不领普通任务。013前进扩grant mode，012原文不改。

Host Port封闭固定goal/ownership/grant；无显式input version拒绝。每次调用中心重验且使用signal/timeout。SDK MCP实例沿O02 flow-goal name，正式key选flow-goal，FQ精确mcp__flow-goal__goal_read与goal_command，并以官方MCPpeer实际list核验。tools=[]禁builtins，PreToolUse要求sdk provenance+精确key/工具，未知拒绝。复用typed final/session/usage/artifact/verifier/outbox，不消费thinking/tool为正文。

0模型验证：真实center+PG+runRunner+生产ClaudeAdapter.run，注入query函数取这次实际options的SDK server，用真实官方MCP协议执行，再synthetic init/result经原事件路径入库。证明host接线/协议/事务，不宣称原生SDK子进程或自然语言模型通过。官方参考 https://code.claude.com/docs/en/agent-sdk/custom-tools 与 /permissions；pinned d.ts已读source='sdk'、tools=[]、env替换语义。
