# COST-001 可解释的执行成本与预算

状态：in-progress（COST01A首纵向片）。2026-10-06。独立大task，承接[FLOW-001 REQ-09](../flow-001-architecture/plan.md)，co-lead Execution Lead；唯一权威在execution-cost工作树。原依赖首片已具备；2026-10-06在TUI01E接收后提高为下一实施位，与O13及网页恢复并行，不打断现有writer。统一遵循[模块化规则](../../AGENTS.md#modular-design)。

## 用户结果与边界

用户能看清一次通过验收的交付消耗了哪些token与估算费用，协调、执行、检索压缩、重试验证各阶段覆盖了多少，未测或不可归因的部分明确显示。预算由中心执行，Web/TUI/CLI消费同一合同。SDK估算不是订阅账单，也不许宣称未被验证的无超额硬保证。

复用usage_samples、稳定sample去重与累计baseline，不另造账本。OpenTelemetry仅作为导出适配器。成本按验收通过的交付、质量和成功率比较；不按便宜但未完成的单调用宣称系统节省。归因来自真实task/attempt/session/阶段身份，不逐条调用模型分类。当前只计划/只读，无新provider或负载预算，不复用封存实验额度。

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

## 当前下一可用交付：COST01A

唯一子片[COST01A](../../../cost-usage-readout/plans/cost01a-usage-readout/plan.md)承担来源分解与共用轻读口，映射COST001-02/03。首片只复用usage_samples和已有baseline事实，提供普通输入/cache-read/cache-write/output/SDK估算、source语义版本与覆盖原因；不重写旧合计含义，不按模型名猜归因，不将不同provider计数直接相加。没有可核来源版本时保留unknown。共享出口/FlowClient及生产挂载由Execution Lead单写，客户端渲染仍可并行。具体只读projection与必要共享seam由该子片固定Interface后实施；不能新增第二账本。
