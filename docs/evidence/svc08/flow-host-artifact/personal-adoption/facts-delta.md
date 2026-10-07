# 维护时间持久表示窄修

本次目标：`472a2a2e37615838779c91a869165f4ed4967c08`，仅 procedure/caller 与5个新事实检查。原r2迁入成功、request FAIL永久保留；旧9+6检查不重跑，没有个人/PG/HTTP新采样。

`persistedFacts(facts)` 是唯一事实提取接缝：只将 `database.runner[].maintenance_updated_at` 的合法Date转完整UTC ISO；已存字符串必须本身是相同 canonical ISO，null只保null，missing/无效/非规范类型拒绝。每个其它字段与未知键完整保留，原 `protection` 全字段 deepStrictEqual 不改；不做全局JSON转换或忽略维护字段。caller在每次snapshot返回后调用一次，后续记录和比较共享同一表示，不修改原facts Module或PG类型注册。

5新例覆盖真实Date与已存相同ISO、不同1ms、null/缺失区别、invalid/noncanonical拒绝、其它维护字段与未知键变化仍拒绝。用自己的已封存脱敏r2 facts复现原表示不等，再验证提取后相等；无私人读取。caller语法单独检查。实测139ms、raw560B、两组absent/双EOF、exact tiny目录checkpoint后正常清理；首unknown/EPERM观察保留在原supervisor report。不是个人替换结果。

后继仍需固定恢复接缝：仅从r2已持久 migration-result/checkpoint/outer 与原before读取精确身份/hash；新exclusive request运行目录与operation ID，重验已迁入artifact/CAS与保护。不再调用migrate/clone/rename，不复制旧outer冒新阶段成功；旧request失败不可覆盖。此段只是可审恢复方案，尚未实现或运行，不能拿当前r2输入直接重试。

本段沿已接受bounded设计，复用本地find-skills/clean-code/codebase-design方法；无新skill安装。单一提取职责、明确持久值Interface、原比较单源、失败关闭与未修改raw已复核；无新增通用规范化框架。
