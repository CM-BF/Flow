# O08 原生图规划验收准备

创建/更新：2026-10-06；in-progress；父O01/U11，承接O07。唯一owner assignment_review / gpt-6-astra。GO已批准0调用准备，不是模型预算授权。

有界设计：复用固定main a26a5f34577d3fdfeee81ef8c0e7d5658617d2b8 的O07 profile/graph grant、现runRunner/Claude adapter与typed final。默认preflight只核配置/schema/SDK版本/权限guard；单独rehearsal在专用PG/tmp用注入query+真实SDK MCP/HTTP练习整条链，明确不是原生broker/NL。未来live显式flag必须提供新的GO单次授权记录、源hash与一次attempt marker，marker在调用前落盘，失败不得自动重跑；本次不提供授权文件、不调用provider/认证/预热。

合成目标：把短发布说明拆成起草→核对→交付3步，仅建立计划。新空project+goal，scope固定baseRevision1/allowedExistingNodes空/maxProposals1/maxApplications1/maxNewNodes3/maxNewEdges2。只graph_read/graph_command；host持runner credential，不给模型owner令牌；禁止工程文件、terminal、外部网络工具和child执行。记录requested/effective、实际工具FQ与extensions，结果核真实持久proposal/apply/graph/final，未知保持未知。

未来候选预算最多1 SDK query、4turns、SDK估算$0.20、90s合作取消；尚未批准实际执行。私有临时DB、动态端口、专属PID/目录；清理证据与执行证据分开；SDK费用上限不冒称最终账单硬上限。

- [x] O08-01 claim/固定基线/技能与三件套。
- [x] O08-02 默认零query预检、单次授权/marker与预算guard。
- [x] O08-03 可运行隔离配置、复用生产runner/SDK桥接的0query真实MCP/HTTP/PG演练。
- [ ] O08-04 原始证据/清理/clean-code/固定交付与独立review。
- [ ] O08-05 新GO单次预算后才真实原生query/NL验收；本轮不执行。

范围只有experiments/native-graph-acceptance、plans/o08-native-graph-acceptance、docs/evidence/o08；不改生产/lock/真实服务/真实凭据。普通技术选择沿已批准边界直接执行，后继原生调用须另获授权。

06:49 UTC：固定6b864881a3acb4957ad8482a7bffc71619f2c8d8，8不同作者检查通过，真实native/NL仍未执行。GO提出未来同次已授权窗口可采CHAT05工具与CHAT06 partial/settlement事实，仅候选、不等组合、不扩大本准备；无UI观察不称live UI。
