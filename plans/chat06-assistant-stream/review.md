# CHAT06 独立审查

状态：NOT_STARTED

- Review target commit：5ff8880b3518992121216998c169dd01ab44cee0
- Base commit：79d6204e4a5781a7041a1545a7424513feaccdae
- Reviewer：未分派
- 范围：SDK部分正文mapper/coalescer、合同、022存储/懒读、既有outbox接线；不含Web/provider实测。
- 验收重点：完整单块先于stop、多message/工具前文字、UTF8与字节限额、父归属、aborted/supersedes、不重复final、失ACK/重启/取消、首次升级。
- 作者检查：72/72（7显式路径，11.56s）、tsc与diffcheck；0模型，原始输出见[README](../../docs/evidence/chat06/README.md)/[manifest](../../docs/evidence/chat06/manifest.json)。独立审查尚未开始，不宣称approval。
- Main/conversations/Web未交付；生产022挂载由Lead，liveAssistantText不得仅凭route存在启用。
- 额外重点：tool boundary前flush真实顺序、独立工具前text retain、final同TX完整replace/retain集合、policy version/unavailable、patch读取wire字节与双绑定。

复核说明：先核实际branch/base/head/dirty，读取固定target及原始证据；只读，不重复旧85或调用模型。findings交唯一owner在claim内修复，结论绑定完整SHA与具体覆盖范围。
