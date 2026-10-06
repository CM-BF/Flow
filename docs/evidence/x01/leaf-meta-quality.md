# X01 零长度metadata拒绝修复

2026-10-06 13:16:08 UTC，owner architecture_read / gpt-6-astra，原claim6ddedc73 v2。Mika对固定`2d20e35ca0019854e102cf051252675eb3f16da6`的正式审查为CHANGES_REQUESTED（1P2/0P1）。原53检查、原manifest及其22raw/6support保持逐字不变。

固定tar7.5.22 `dist/esm/parse.js:124` 用 `opt.maxMetaEntrySize || default`，所以0回默认值；218–238比较 `entry.size > maxMetaEntrySize`，零payload原本不进入meta/ignoredEntry。公开Parser属性类型见`dist/esm/parse.d.ts:43`，README最大metadata参数说明585–586/865–866，`dist/esm/read-entry.js:57–63`列出六种meta。选项的options.d.ts含internal注释，README和导出的Parser数值属性确实存在；本片明确绑定7.5.22的实际比较行为，不泛称所有版本有专门“禁meta”选项。

最小修复仅把已有数值上限设-1，所有合法非负metadata大小进入已有ignoredEntry整包拒绝；没有读取私有symbol、复制parser或自写Header解码。最大JSON16KiB仍独立用于声明；完整gzip≤1MiB/CRC/二次压缩拒绝/512块feed/EOF尾部规则不改。

六种meta×合法文件前后两位置共12个真实red，原实现均错误resolve；修复后12通过/39未选。最后同两显式测试路径65不同=原53+12全部通过、严格局部noEmit0；66个精确自有根已确认删除，retained[]。聚焦轮不与最终轮累加。没有安装、PG、provider/network或实际runner负载。原断言未删；test仅扩充Header类型联合并追加12case。host/fixture/manifests依赖全部不变。

沿本地find-skills→clean-code（sickn33@bdacd76，固定SHA3c4115e1…317）/codebase-design/tdd复核：Module只负责静态材料，Interface不变；拒绝策略集中于原Parser配置与现有error处理，不增加抽象/状态/缓存。特定版本注释解释0与-1选择。元数据已纠正“无产品实现”的陈旧现状，完整publicvertical与第三方隔离仍未完成。
