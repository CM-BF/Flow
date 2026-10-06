# O08 已知原生资源候选

固定target `7403b56b98070848c189c2d36663cb89846977be`，2026-10-06 07:08 UTC。GO批准实施本候选，仅0query；原`decfcee90264f84ecf3c02874c1e6c85d65bfe13`独立批准历史及[原manifest](manifest.json)原样保留，不能用它覆盖本候选。产品base仍a26，不等待CHAT06或修改产品配置。

请求配置不变：tools/settingSources/plugins/skills仍空，strictMcpConfig/dontAsk，只有两个flow-graph FQ。新允许的只是SDK init中的**声明名字**：3plugins={cc-plugin-agents-md,cc-plugin-telemetry,cc-plugin-plugin-authoring}，3skills={design,doctor,plugin-authoring}；无重复/缺项/未知。实际MCP仍唯一flow-graph、source=sdk、connected，工具声明恰好2项。插件version自报仅记录，不当信任或固定版本证明，不保存插件路径。

依据本机锁定SDK0.3.290 sdk.d.ts2242–2275，settingSources控制filesystem settings，skills只是context filter非sandbox；5915起init是session metadata，不能作为执行证明。记录requested与SDK declaration后，host wrapper原样调用已有PreToolUse授权，不改policy，只记工具名/来源/server/有限ID/allowed|denied|unknown，最多64条，超出abort。execution字段恒not-observed：allow与实际执行分开；center的真实grant/audit/graph才证明持久图变化。SDK result.permission_denials保留source/总数和最多32名字/ID，参数全部省略，缺失unknown，与reported empty区分。未知/任何denial不能通过原生最终验收。

已知managed基线来自[历史会话](../f01/queue-live/turn-1.json)与[固定hash说明](known-extensions.json)，不是重新探测当前环境。GO接受只授予两图工具的验收范围，不宣称组织hooks隔离、插件无副作用、全进程无网络/文件写。原生尚未就绪，待新target独立review及GO既有单次预算流程；本轮无permit/query/auth/凭据读取。

实际检查（仅局部，不重旧11或产品套件）：

- [managed-red.txt](managed-red.txt)：旧零扩展gate拒绝已批准候选，1失败/1通过。
- [managed-final.txt](managed-final.txt)：5/5，集合接受与unknown/重复拒绝、实际生产host gate允许/拒绝与参数脱敏、未知与64上限、32条SDK拒绝记录上限。没有把合成EPERM/回调错误称实际原生错误。
- [managed-consumers.txt](managed-consumers.txt)：仅选2个直接受影响guard用例，2/2，其余3未选；不是整个原11重跑。
- [managed-rehearsal.json](managed-rehearsal.json)/[stdout](managed-rehearsal.txt)：受影响worker插桩路径复跑**同一**0query演练，不增加新场景；真实MCP/HTTP/PG，三条host allow分别read/propose/apply且execution仍not-observed，独立中心audit/3节点2边/typed final验证通过。SDK result拒绝数组report empty，0native，整组/center/DB/tmp清理全true。演练注入结果不证明NL。
- [managed-preflight.json](managed-preflight.json)保存新sourceDigest；[managed-syntax.json](managed-syntax.json)10mjs语法exit0。

本轮新5项，另2旧直接消费者+1旧演练，共本轮8个不同检查；跨片段累计16个不同，而非一次16/16。先前managed-first2绿为重复，不叠加。[新manifest](managed-manifest.json)绑定11source/9raw、6产品依赖、SDK d.ts与历史记录。独立review NOT_STARTED。
