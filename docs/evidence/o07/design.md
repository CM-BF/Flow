# O07 小设计与技能方法

2026-10-06 05:40 UTC：Node24/TypeScript/PG/固定ClaudeSDK0.3.290/MCP1.32.1，同stack复用并实际读用本地find-skills、codebase-design、clean-code、tdd、brainstorming（/Users/citrine/.agents/skills/*/SKILL.md）。本轮本地匹配，不重装。clean-code sickn33/agentic-awesome-skills固定bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5。Root/Lead已明确批准设计与HTTP/MCP/PG测试seams，不重复许可。

选择复用现Claude loop与O06授权深module；新graph host port只把固定grant/ownership封在closures，server每次核权。O02 result/failure负责64KiB编码结果与unknown，node/graph两caller共享host invoke/SDK gate，避免复制权限状态机。可信profile独立goal-graph-tools，与旧goal-tools互斥；ordinary purpose拒绝两种专属profile。纯SDK in-process MCP可先独立验证，再接claim/真实PG，绝不把纯handler叫完整接入。

工具graph_read只读固定base图分页或按需proposal；graph_command只propose/apply+stablekey。内部SDK注册名flow-graph（实际server.name作key），hook仅sdk来源+精确2工具+当前ownership允许。材料空，其他Read/Bash/Web/写工具都拒绝。原始goal/constraints/acceptance由中心native受理时有界组装prompt，不能从空图猜测。019扩mode，不改旧grant/call。

共享client/export/index由Lead；现两K02文件未领取不写。新profile/native合同先行，组合基线为45b720而非main。无服务61228/4320操作，无模型调用。后续1query候选与本实现授权不同。

2026-10-06 05:47 UTC clean-code工作段：MCP复用既有有界result/failure，node与graph两caller共用精确SDK来源gate；中心复用acceptTask内部purpose及O06原事务，没有复制授权或受理INSERT。保留旧node错误码。发现测试误把TaskSummary当完整submission，改由真实DB核对应submission，不改变产品轻读；中间失败stdout保留。017→019实际旧grant+audit迁移通过。余项：两claim字段及公共client受控接收、生产adapter实际接线、定稿复核。
