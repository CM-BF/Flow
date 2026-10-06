# B03 技能与质量

2026-10-06 04:57:17 UTC：find-skills本地优先，读取 /Users/citrine/.agents/skills/find-skills/SKILL.md、brainstorming/SKILL.md、codebase-design/SKILL.md、clean-code/SKILL.md、tdd/SKILL.md。clean-code来源sickn33固定bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，不重装。Bounded设计/HTTP+store seam已获派工批准，不重复approval。应用：明确preview类型避免假完整内容；共同参考映射保身份；真实PG先红后绿；仅ownDB动态port。复用已装node_modules，@flow映射本WT，不改lock。

PG16官方依据：https://www.postgresql.org/docs/16/functions-binarystring.html 与 https://www.postgresql.org/docs/16/functions-string.html；保留convert_to UTF8，不用content::bytea；PG仍全量hash。

2026-10-06 05:02 UTC：代码工作段复查：preview数据/hasMore/digest同SELECT，detail三键/小写摘要严格比对，类型不暴露content，pending有效settings原样；full/legacy未改。21+22=43不同用例全通过，首1绿已含21不重复计。原consumer bodies byte-identical，新harness语法失败修正并保留；Root预审指出stopServer异常应finally pool.end，已补且仅影响失败清理路径，不为纯seam修复重复22。

2026-10-06 05:04:22 UTC：after/交付自查：9实现文件与固定target字节一致；43行为/126HTTP字段一致，自有库均清理；raw只含SQL模板/数值无正文/凭据。decoded JSON、Node→PG hash迁移、短正文92B开销及latency波动明确，禁止速度/CPU臆测。不重测metadata。内部preview接口影响由Lead同步固定架构。

2026-10-06 05:05:47 UTC：Root独审APPROVED target9b2156d，9实现28证据hash/6baseline源码/43用例/126重算/5库清理已核，无blocking，未重跑；只批准有界preview，不扩CPU/PGwire/legacy/N+1结论。当前status新增本片段交付阶段integration，main接收后再delivered。保留已审manifest历史字节（内部NOT_STARTED是生成时记录）；当前批准以review/status为准。
