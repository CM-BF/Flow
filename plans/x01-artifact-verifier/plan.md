# X01-ARTIFACT-VERIFIER01：安装式 JSON 产物验证

创建/最近更新：2026-10-07；状态：in-progress（AV02局部能力与journal已main；center局部已审，真实PG与完整链开放）。
所属大task：[X01 插件管理 / X01-07](/Users/citrine/Projects/AgentHarness/Flow-worktrees/plugin-enable-binding/plans/x01-plugin-management/plan.md)，co-lead：Mika；唯一 owner：architecture_read / gpt-6-astra。

## 用户结果与边界

用户选择一个中心已保存的**精确产物版本**，选择已安装且获 verifier 授权的包和有限规则，创建独立验证任务。首个能力判断正文能否解析成 JSON 对象、是否具有指定的自有字段；中心用已保存原文独立计算，不能由插件一句 `passed=true` 决定通过。新的规则或包版本产生新的验证身份，不能沿用旧通过。生产者任务、旧产物和旧验证结果保持不变。

这不是通用 JSON Schema：不检查字段类型/格式、不执行脚本/正则/远程引用、不自动修复、不递归搜索、不运行模型。首片不自动拦截所有普通任务，也不实现同一个 attempt 内的任意插件流水线。原 flow.text、engineering 和 native 验证语义保持原样。PROCESS 的待集成/真实制品 T7 优先；本设计不能当作其主线或隔离验收。

## 已确认选择和备选

| 方案 | 收益 | 代价/结论 |
| --- | --- | --- |
| 独立验证任务引用精确产物（选择） | 复用 task、单 binding、claim、AttemptControl、journal、outbox；可独立取消和审计 | 新的不可变来源引用与显式 verifier 资格，确有跨模块合同变化 |
| 生产者 attempt 内后置 verifier | 可隐式阻止生产者完成 | 现 034 task 唯一 binding、runtime 插件分支和 completed ACK 时序均需扩大；第一片不选 |
| 只加中心内置 JSON 校验 | 更小，能判 JSON | 不能满足安装式 verifier/真实宿主/换包身份的 X01-07，不能替代本目标 |

首片仅 `flow.json-object.required-keys` algorithmVersion=1。规则 v1 示例 requiredKeys=["id"]，规则 v2 示例 requiredKeys=["id","email"]；这是两份不可变规则快照，**不是修改同一规则记录**。正文 {"id":1} 必须 v1 通过/v2 失败。包 A/B 的 version/material digest 不同也必须产生不同 inputDigest，即使算法行为相同。尚未实现的 algorithmVersion=2 必须拒绝，不能用旧算法默默运行。

## Interface / 生命周期

完整输入输出、边界、源代码依据、性能与错误见 [interface.md](../../docs/evidence/x01-artifact-verifier/interface.md)；精确后继候选路径与当前 owner 见 [scope-and-dependencies.md](../../docs/evidence/x01-artifact-verifier/scope-and-dependencies.md)。设计统一引用 [模块化规则](../../AGENTS.md#modular-design)，不创建第二 registry、runner、授权状态或发送循环。

## 分片与 TODO（只在证据满足时完成）

- [x] AV-01：固定当前 main/owner 事实，给出有限算法、完整旅程、权责/安全/恢复设计。仅文档产出，独审另列。
- [x] AV-02：合同、纯算法、安装 manifest kind 与真实受信 host 局部能力；显式 v4 资格/journal 不降级方案。完成需真实 A/B 包材料和直接消费者反例，不能只 helper/mock。
- [ ] AV-03：center→公开 admission→明确 verifier runner→真实包→中心独立重算→只属于验证任务的 typed result，一次有限 PG 纵向验收。新 migration 编号另领取；真实 PG 另 window。
- [ ] AV-04：实际启动配置与 CLI/现产品读取接线、精确材料与当前信任策略实证；PROCESS 只复用已批准的真实制品/释放能力，不重造隔离框架。全 X01-07 验收回父计划，不以局部通过代替。

## 验收矩阵

| ID | 必须证明的触发 → 预期 | 验证层/本轮状态 |
| --- | --- | --- |
| AV-A | 合法对象/缺字段/数组/null/语法错误/自有键区别 → 明确 bounded verdict | 纯算法+真实受信host AV02局部已验/main；中心端独立重算仍未验 |
| AV-B | {"id":1}，规则 v1→v2；包 A→B；artifact/version/algorithm 改变 → 旧通过不复用 | 本地两材料/规则局部已验；中心PG换版仍NOT_RUN |
| AV-C | 恶意包报告假 passed / 错 source/version/inputDigest / 错 phase owner → reportEvents 整批回滚，ACK 前缀不前进 | 真 PG/HTTP，不能仅 SQL fake；NOT_RUN |
| AV-D | 不支持 verifier 的 v1/v2/v3 runner，队列前部 verifier 后部普通任务 → SQL LIMIT 前跳过，旧任务仍可领取；显式 v4 才领匹配算法/store/runner | 真 PG mixed queue + journal 完整 ACK；NOT_RUN |
| AV-E | 同 key 更换协议/资格/规则/来源 → conflict；ACK 未知 → 原 key/body/assignment 保留，重启只重报 durable 终态，不重 invoke | journal实际FS局部已验/main；v4中心PG/完整verifier恢复NOT_RUN |
| AV-F | 撤 verifier grant/runner revoke/旧 owner/取消 → 下一 phase 拒绝；load前已知拒绝可无verdict failed，确认资源闭合取消可无verdict cancelled且保持未验证，unknown不得completed；disable不改旧pin，迟到事件fenced/exact replay幂等 | 真 PG/受控 host；NOT_RUN |
| AV-G | 超长正文/规则/序列化输入 → 413/400 无 task/binding/audit 残余；失败 verdict不改源任务/旧产物 | codec + PG 事务；NOT_RUN |
| AV-H | 实际 CLI/启动选择显式 verifier 能力，旧 session/journal 不重置；用户能区分中心确认的失败结果、未验证的执行失败/取消与UNKNOWN，不伪造failed verdict；成功不能省略verification | 实际入口/有限产品消费，Web writer另协调；NOT_RUN |

## 实施解除条件与非目标

当前a67v4已领取明确产品与准备范围；AV02九叶已main e271、journal四叶已main b791；center14源局部独审通过但036/真实PG未运行。后继跨owner路径仍须按当前版本部分 handback/take，先处理 PROCESS 正在持有的 runtime/execution 以及 X01 父合同/center 叶，迁移槽另协调。文档 reviewer 可以要求设计窄修，不因此启动实现或工程检查。不能声称第三方包 sandbox、host release、物理卸载、任意未知副作用恢复、个人部署或完整 X01 已完成。

2026-10-07设计窄修：按14:42:49独审P2补完成矩阵；同时要求独立正向持久kind及project_task_bindings/适用conversation来源授权，缺失/冲突拒绝。新migration编号/FK仍待合法领取，产品全部NOT_RUN。
