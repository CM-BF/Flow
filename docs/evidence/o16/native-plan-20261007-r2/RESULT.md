# O16 R2：规划失败，资源停止并保留

一次 plan 从 2026-10-07T10:47:46.949Z 开始；operator 26,177 ms、exit 1 / unknown-retain。本次实际进入 SDK 1 次，累计 2 次；一次材料已消费，没有第三次许可。结果待独立真实性审查。

初始化声明与固定私有 recipe 相符：claude-sonnet-5-5、runtime 2.1.290、2 plugins/2 skills、仅两个 graph tools、SDK MCP connected。4 帧后结果 subtype success、isError true、numTurns 1，固定观察器拒绝；没有成功 proposal 或 pause receipt，未进入确认、apply、children 或语义接受。

SDK 报告本次 total_cost_usd 0、modelUsage {}；这不证明账户实际零计费。首轮费用与累计账户费用仍 UNKNOWN。reads [] 与 hostToolDecisions [] 只说明保存的观察内容，不冒充已读取中心完整 audit。

最早持久错误为 SDK isError true 与观察拒绝；异常只保存 Error/code:null。exact 私有 plan/report.json 与 durable worker 投影相同，未含 SDK result.result / errors 正文。query-policy 不保存它们，worker stdio 为 ignore；私有树没有 stderr/transcript 文件。仅检查自有目录元数据及这份报告，没有读取凭据、native 配置/备份或 worker 输入。上游首因 UNKNOWN，不能据此归因于 provider、模型、账户或认证。

原资源记录于 10:48:13.149Z 持久 server/admin 关闭、worker 停止、连接 []；10:49:10.010Z 追加只读核实 65502/66924/65501 三组 ESRCH、目标 marker/OID 相同、连接 []、observer pool 关闭，并归还窗口。DB flow_o16_269a60ce63d345b68775b3e24fc974f7（OID 1290288）与 /private/tmp/flow-o16-GSdvBz（dev16777234/ino124061319）KEEP，无 DROP/rm。paused-owned-resources 是关闭后保留资源的阶段，不能解释为规划成功后的15分钟暂停。

本轮最终测量 raw 13,261 B / runtime 16,857 B / 23 entries，measurementFailure null；不据此改写首轮采样未知原因。监督中间 stopCheckpoint pending 与最终 durable 原件分别保留。旧 R1 init 拒绝/计数矛盾、费用未知和 DB/tmp KEEP，以及更早零模型失败，全部不变。

- [原始 stage](../runs/native-plan-20261007-r2/plan.json)
- [原始 operator](../operators/native-plan-20261007-r2/plan/result.json)
- [实际窗口归还](window-return.json)
- [限定只读证据缺口](diagnostic-readonly.json)
- [派生分析](result-analysis.json)

封存沿既有 find-skills / codebase-design / clean-code 方法：源码与原输出不改写，一次材料与真实计数分开，首错与关闭分开，SDK费用声明与账户事实分开。不新增执行器、诊断 query 或清理权限。
