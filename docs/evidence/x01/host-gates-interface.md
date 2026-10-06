# Host 两阶段当前权限 gate

设计核定：Mika/gpt-6-astra，2026-10-06 14:41 UTC。owner architecture_read，唯一WT plugin-management-plan，v5只持host.ts/host.test.ts及两metadata。基线8e520；中心a578八源已main56d90并交回，无共享源码同步需要。

现有invokeInstalledTool本地Interface的authorize(binding)增加第二参数phase: 'load' | 'invoke'。两个gate拿到同一个已深冻结、已脱离调用者引用的binding/invocation；授权owner须每次实时读当前grant，先前ACK/旧pin不能代替。load位于真实ESM import之前；import正常settle且host API有效后，先核ownership/abort，再执行invoke gate；任一gate返回后再次核ownership/abort才执行对应包动作。明确拒绝或ACK未知均按调用者原Error身份直传，不折为PACKAGE_FAILED；host不重试、不恢复授权或包执行。pending包import/invoke的abort仍OUTCOME_UNKNOWN，合作取消不证明包停止。

本片只变host两源。真实self-owned fixture经原prepare/read与实际dynamic import/invoke：TLA等待中撤权→0invoke；两个phase ACK未知→0对应动作；每gate后ownership/abort阻动作；成功顺序load→invoke/同一冻结对象。旧同文件14个行为作为直接消费者一次，材料51不重跑。保持稳定file URL、16KiB输入/输出边界、未知runtime refs由上层负责；不实现中心live grant、runtime retained、持久化或public vertical。

按[模块规则](../../../AGENTS.md#modular-design)：既有host Module负责包动作顺序，authorize外部依赖负责权限权威，readInstalledPackage保持唯一材料校验；新增一次授权往返为必要成本，不加缓存/框架/第二FSM。架构图待Lead在集成时更新本地host授权时序，生产main能力与分支分别标注。

本地技能发现：TypeScript/Node ESM局部行为，已有find-skills、codebase-design、clean-code、TDD匹配；沿/Users/citrine/.agents/skills对应SKILL.md，clean-code固定sickn33@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，SHA3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317。授权seam已由Mika核定，先真实red再最小实现；不安装技能/依赖，0provider/PG/实际runner/额外进程负载。
