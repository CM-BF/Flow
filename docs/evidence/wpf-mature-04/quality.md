# WPF-MATURE-04 技能与文档质量

任务：上下文窗口/使用透明度的首片架构规划；stack：现有TypeScript/Zod合同、Node24中心与runner、PostgreSQL持久事实、由d01管理的React Web消费者。本片只写计划与证据。

| 技能发现/来源 | 实际应用 |
| --- | --- |
| `/Users/citrine/.agents/skills/find-skills/SKILL.md`，本地优先 | 先识别架构/合同/文档任务；已有匹配本地技能，不联网安装或引入无关技能 |
| `/Users/citrine/.agents/skills/brainstorming/SKILL.md`，本地现有版本 | Architectural路径比较中心投影、浏览器推算、SDK透传；依据已有用户/GO授权与指定目录编写计划，不重复索权，不扩展为实现 |
| `/Users/citrine/.agents/skills/codebase-design/SKILL.md`，本地现有版本 | 单个小ContextSnapshot Interface隐藏来源差异；真实来源Adapter与投影分离；使用现有K02引用seam，不复制全文/另造usage账本 |
| `/Users/citrine/.agents/skills/clean-code/SKILL.md`，固定来源 `sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5`；SHA256 `3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317` | 使用独立明确的capacity/used/remaining命名；区分selected/authorized/read；错误/unknown显式；不机械拆方法，不让前端复制中心逻辑。本地hash先前已由Lead核验，本片不重装 |

2026-10-06 08:59 UTC开工检查：从源码确认profile不等于provider能力、累计usage不等于当前窗口、K02字节限额不等于token上限。已将这些区别写入合同候选和验收；R05仅本地descriptor，未对它附加字段。范围只含plan/evidence，产品代码风险未通过任何测试背书。

提交前再检查本地链接、稳定TODO/status、claim literal scope、NOT_STARTED及候选/已实现语义。结果单独记录在[validation](validation.md)。未解决项是后续实施的provider字段、测量覆盖和共享scope协调，不是已经验证通过。

本片再次只读核四个本地技能SHA256并记录[hash证据](skill-hashes.json)，clean-code与全局固定基线一致。接mika精确SDK输入后复核候选：将model硬容量与compaction策略窗口分开，SDK来源与estimate准确度分开，增加full默认成本/summary未知生命周期、deferred排除数学及Codexlast语义未知约束。没有以字段名猜当前上下文，也没有新增provider调用。

2026-10-06 09:09 UTC实现交付前clean-code复核：schema负责形状/数值证据语义，projection负责当前identity/freshness及窗口算术，无IO或隐藏状态；复用现有harness/profile/knowledge引用合同，不复制auth/usage/压缩状态机。发现并修复两处语义漏洞：derived输入为estimate不能在输出升级provider；SDK autocompact report不能填hard modelCapacity。源与方法分离，limits命名区分modelHardLimit/compactionPolicy。遵循[唯一模块化规则](/Users/citrine/Projects/AgentHarness/Flow/AGENTS.md#modular-design)，未复制框架规则。

资源界限：4材料/8192选中bytes、32categories、65536响应bytes；未知与失效在Interface内集中；pure函数返回detached对象，既有固定队列/attempt不受draft变更影响。没有声明性能提升或provider真实token精度。剩余限制：host将真实素材变更可靠映射到identity digest、SDK来源适配、持久化/鉴权/重启与UI尚未实施，由完整TODO继续跟踪。

2026-10-06 09:22 UTC第二片复核：继续使用相同本地find-skills/brainstorming/codebase-design/clean-code，无重装。按既有授权选纯summary-response Adapter；直接透传泄漏路径/名称，full采集引入provider调用，均不采纳。新2文件只持数值归一化职责，与中心projection权限/持久owner分离；type-only SDK、最多32分类、4匿名kind分组、reject overflow/缺字段，不截断。23 Adapter + 23直接消费者 = 46/46，局部strict noEmit通过。先前4源码保持879审定内容；不增加通用框架或改变共享接口。证据见[纯适配器](claude-summary.md)，未解决项明确留原TODO。

2026-10-06 09:26 UTC P2修复复核：独立review暴露来源适用范围缺口，接受修正；attempt+非空nativeSession为最小source前置条件，draft/queued留独立估算器，不新增状态或抽象。测试默认attempt，拒绝pending/无session，保留detachment、身份失效与隐私等原断言；修后26+23=49/49、strict noEmit0。旧46是历史，不替代本次证据；source Adapter仍依赖authenticated host绑定已消费cut。只修2源码，879已审4文件保持不变。

2026-10-06 09:32 UTC：approval metadata与22行中心store请求为文档变更；沿相同find-skills/codebase-design/clean-code方法复用既有事务/锁/序号，不造第二endpoint或状态权威。核read-only main/ledger、链接与diff，完整6源码保持已审target；不重复工程测试。具体source/消费cut、migration编号和共享writer须Lead固定后方可amend开写。

2026-10-06 09:38 UTC：按codebase-design/clean-code只读检查真实事件生产/持久顺序，发现把运输序号当消费cut会让正常完成后始终unknown。撤回此候选，首store建议限历史样本；current依现有result/receipt/seal与明确采样时点定义有限边界，避免另造通用FSM。main/owner HEAD、dirty、v3与6源码hash已核；本轮只做文档链接/diff检查，无工程测试。

## 2026-10-06T10:33:41.339595+00:00 历史片工作段

本地find-skills发现既有TypeScript/PostgreSQL/HTTP相关方法，沿codebase-design/brainstorming已批准八文件的小Interface与固定clean-code（sickn33 bdacd76，未安装）实施。按AGENTS modular-design：事务/fence仍归reportEvents，归一化归runner，store仅身份/引用绑定与历史幂等，GET只读。检查并修正requested alias不能充当resolved事实；严格有限wire不收正文/路径/伪ref，历史DTO不计算current/remaining。33局部用例与继承root严格noEmit通过；真实PG与生产鉴权尚未验证，等待唯一正式migration，不复制DDL。六个已审源保持冻结。
