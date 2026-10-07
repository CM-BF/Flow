# COST-001 可解释的执行成本与预算

状态：in-progress（首纵向读口已交付，中心共享预算为下一结果）。独立大task，承接[FLOW-001 REQ-09](../flow-001-architecture/plan.md)，co-lead Execution Lead；唯一权威在execution-cost工作树。原依赖首片已具备；2026-10-06在TUI01E接收后提高为下一实施位，与O13及网页恢复并行，不打断现有writer。统一遵循[模块化规则](../../AGENTS.md#modular-design)。

## 用户结果与边界

用户能看清一次通过验收的交付消耗了哪些token与估算费用，协调、执行、检索压缩、重试验证各阶段覆盖了多少，未测或不可归因的部分明确显示。预算由中心执行，Web/TUI/CLI消费同一合同。SDK估算不是订阅账单，也不许宣称未被验证的无超额硬保证。

复用usage_samples、稳定sample去重与累计baseline，不另造账本。OpenTelemetry仅作为导出适配器。成本按验收通过的交付、质量和成功率比较；不按便宜但未完成的单调用宣称系统节省。归因来自真实task/attempt/session/阶段身份，不逐条调用模型分类。首纵向读口已交付，后继仍无新provider或负载预算，不复用封存实验额度。

## 模块责任与接口

| Module | 输入输出及状态所有权 | 扩展/界限 |
| --- | --- | --- |
| source-specific usage adapter | 固定provider/SDK版本、计数范围、原始字段→明确语义sample | input与cache是否包含/独立/未知必须显式；不能统一把input+cache相加；原始sample保留 |
| normalization与现usage账本 | sampleId、stream、baseline/segment、scope、覆盖→可审贡献 | 重放/乱序/累计差分与冲突保持；reset/resume/fork/失败缺测不自动猜零或猜减 |
| center预算与归因 | 已知贡献、并发在途/未知预留、预算policy→受理/暂停及解释 | 中心唯一权威；估算和执行上限不同，未知不因本地空闲释放；先设计race再实现 |
| shared readout / exporters | 轻汇总、覆盖、分解及授权原始详情→三种客户端和OTel | 详情分页/按需；出口不回写第二账本、不存凭据/正文 |

首实现候选是0模型的source→normalized→center/readout有界纵向片，使用固定已保存/合成sample、真实随机PG和直接消费者检查。先只支持已核语义，跨provider未知保留。共享用途明确后才提取，不引通用可观测框架。具体product scope和migration号在空槽派工时核账本，不在本管理claim里写代码。

## 稳定TODO

- [x] **COST001-01** 唯一计划、当前来源缺口与队列优先级。
- [ ] **COST001-02** 固定Claude modelUsage、Codex total/last/cached等source语义与版本；分类cache子集关系、辅助调用覆盖与计数重置。
- [ ] **COST001-03** 有界normalized合同和PG贡献/覆盖纵向片，保旧sample/旧读者与幂等。
- [ ] **COST001-04** 明确阶段归因和按验收通过交付的成本视图，未归因保留；Web/TUI/CLI同读口。
- [ ] **COST001-05** 中心预算并发、unknown在途、超额与恢复策略；真实race/失败证据。
- [ ] **COST001-06** 可选OTel单向出口，固定semantic convention版本，非第二权威。
- [ ] **COST001-07** 独审、文档、完整覆盖验收；有授权时才做同条件真实对照，不用模型证明字段。

## 验收矩阵

来源及计数单位/范围/缓存关系/辅助覆盖清楚；重放不重计、同ID异内容拒绝；负差/缺baseline/reset/fork/crash/乱序保unknown；identity与阶段绑定且无文本分类；原始可追回和汇总覆盖相符；并发预算与unknown资源race明确；详情、查询、缓存、导出队列有界；费用估价/实际账单/订阅额度分开；机械成功与业务语义通过分开。纯文档只核内容、来源与链接，不重跑产品套件。

## 当前源码与研究

固定main77c420c：claude.ts已保存cacheRead/cacheWrite到usage event；server usage.ts贡献/汇总只input/output/cost，tasks.ts UsageTotals没有缓存分解；Web标签Input tokens未表达source计数口径。因此当前不足以跨provider汇总token或证明cache节省。见[research.md](../../docs/evidence/cost01/research.md)。MATURE04的上下文容量不等于本任务成本账本；E01 harness对照保持独立，勿复制计划。


COST001-02补充候选：稳定资料前缀结构toy及明确限制统一见[研究记录](../../docs/evidence/cost01/research.md)。只读来源与字节边界不代表token节省；具体实施待空槽fresh scope，不修改当前context或附件版本，不提高到ENG/TUI/附件前。

## 已交付首片：COST01A（历史范围）

唯一子片[COST01A](../../../cost-usage-readout/plans/cost01a-usage-readout/plan.md)承担来源分解与共用轻读口，映射COST001-02/03。首片只复用usage_samples和已有baseline事实，提供普通输入/cache-read/cache-write/output/SDK估算、source语义版本与覆盖原因；不重写旧合计含义，不按模型名猜归因，不将不同provider计数直接相加。没有可核来源版本时保留unknown。共享出口/FlowClient及生产挂载由Execution Lead单写，客户端渲染仍可并行。具体只读projection与必要共享seam由该子片固定Interface后实施；不能新增第二账本。

## 2026-10-06T14:35:06.228081+00:00 首纵向交付与剩余目标

COST01A已独审并与公共factory、FlowClient和只读CLI进入main59ef2134。共享基线贡献函数由原写入与新投影复用，旧合计未改义；历史缺版本、resume baseline与覆盖不足仍明确unknown。COST001-02/03保留跨来源归一未完边界，04的CLI读取部分已完成，阶段归因与Web/TUI显示、05中心预算未完成。不以首读口将完整大task勾完。

## COST001-05 下一用户结果：多 runner 共享预算受理与在途保留

2026-10-07 管理更新：由 Execution Lead 负责本片规划/接口与后续独立 owner 派工，产品 writer 尚未领取。优先级排在当前新网页发布、消息设置与已有 ready 用户链路后；当前只固化验收，无 PG、负载或 provider 新预算。不是新增大task，也不把已交付分解读口冒充并发预算。

用户为同一范围设置预算后，多 runner 的受理共同消耗可解释的预留；拒绝、在途及结果未知能从同一公开读口理解。复用 `usage_samples` 的已知贡献、累计 baseline/segment 和现 claim/attempt 身份；中心事务是受理与预留唯一权威，客户端和各 runner 不各自维护全局余量。具体持久字段/迁移与小 Interface 在实施前按现 owner scope 冻结，不先造第二账本或配额服务。

| 原子接口责任 | 最小验收与保留语义 |
| --- | --- |
| 中心受理/预留 | 同一剩余额度由两个独立 runner 同时竞争，不超出声明的受理/预留界限；同 key 重放、丢 ACK、中心重启不重复占用。身份必须绑定已授权 task/attempt，不能由客户端数字自证。 |
| usage 对账与释放 | 迟到 usage 按稳定 sample 去重；累计 baseline/reset/resume 缺口不猜减或猜零。断联、超时、cancel 或本地空闲不等于外部已停，unknown 在途不自动退款；明确结算事实与人工恢复边界后才按版本化规则释放。 |
| 共用轻读口 | Web/TUI/CLI 区分已知贡献、在途预留、未知覆盖及可受理边界；次数/并发限制与估算 USD 分开，保留已交付 readout 的 producerVersion/phaseAttribution 未知。 |

先交 0 模型局部纵向片：两个真实受理消费者、有限专库 race、重复/丢 ACK/重启、迟到 usage/unknown 与既有 baseline/reset 样本。使用当前公开合同及直接消费者，不重复容量全套，不因有本地 SDK 限额宣称中心全局限额。实际 provider 仍须具体新场景/独立预算。

SDK 本地估算、中心可证明的受理/预留规则与最终账户账单是三种口径；不能承诺账户费用绝不越界。当前 adapter 禁止 Agent，未发现由这条研究增加 native 子agent 的事实。固定 SDK 行为与最新文档分开，来源及限制见[研究记录](../../docs/evidence/cost01/research.md#2026-10-07-共享预算与sdk限额边界)。
