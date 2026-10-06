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
