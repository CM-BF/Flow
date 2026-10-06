# B03 数据库完整校验的聊天预览

创建/更新：2026-10-06 04:57:17 UTC；状态：in-progress。Bounded设计已获Goal Owner/Lead批准，0模型/云。

- [ ] B03-01 真实PG/HTTP红用例，再实现明确preview type/reader；全文reader、公开契约与legacy原样。
- [ ] B03-02 Unicode/摘要破坏/身份/门禁矩阵及原22consumer原断言安全fixture通过。
- [ ] B03-03 固定源码做一次1/20/50×短/长对照，PG decoded JSON/HTTP UTF8及原始SQL分类，资源清理。
- [ ] B03-04 独审/质量/架构影响/最终dashboard事实源收尾。

同一SELECT返回PG left(content,4000)、hasMore及encode(sha256(convert_to(content,'UTF8')),'hex')，三键限定detail。JS严格比较持久digest，复用现有4000 UTF16裁高代理并合并truncated；reference/settings与pending路径保留。新preview不能冒充完整AssistantMessage。保持5N+2查询；PG仍整文转换/hash，非CPU收益/非PG wire/非legacy优化。

范围仅claim7项；不改state/queries/task/writer/migration/client/全局index/lock。架构影响仅assistant内部读取接口，由Lead在集成后更新固定图。
