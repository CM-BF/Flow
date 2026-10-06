# CHAT06 独立审查

状态：APPROVED

- Review target commit：d9a162738c5c3b3531fc7f5da3a5c0ea1e846e67
- Base commit：79d6204e4a5781a7041a1545a7424513feaccdae
- Reviewer：Root / gpt-6-astra；2026-10-06，独立只读结论由owner于06:43:03 UTC转录。
- 范围：SDK部分正文mapper/coalescer、合同、022存储/懒读、既有outbox接线；不含Web/provider实测。
- 验收重点：完整单块先于stop、多message/工具前文字、UTF8与字节限额、父归属、aborted/supersedes、不重复final、失ACK/重启/取消、首次升级。
- 作者检查：72/72（7显式路径，11.56s）、tsc与diffcheck；0模型，原始输出见[README](../../docs/evidence/chat06/README.md)/[manifest](../../docs/evidence/chat06/manifest.json)。Root核原始输出，不把作者运行计为独立重跑。
- Main/conversations/Web未交付；生产022挂载由Lead，liveAssistantText不得仅凭route存在启用。
- 额外重点：tool boundary前flush真实顺序、独立工具前text retain、final同TX完整replace/retain集合、policy version/unavailable、patch读取wire字节与双绑定。

复核说明：先核实际branch/base/head/dirty，读取固定target及原始证据；只读，不重复旧85或调用模型。findings交唯一owner在claim内修复，结论绑定完整SHA与具体覆盖范围。

## 独立结论

Root批准固定5ff8880b3518992121216998c169dd01ab44cee0；现场metadata b4d28d7b81eb7d2e4957734199dc1377ddef4fd3，源码冻结。15项source、21项raw、SDK 3项与6项只读核对记录的hash全核；72个不同局部行为、tsc和自有DB清理记录吻合。无P1/P2、无blocking finding。独立审查未重跑tests、未调用provider、未修改源码。

批准只覆盖注入SDK→durable outbox→PG→owner读取片段，不覆盖真实provider、页面交付、首token延迟、费用或DB容量。1MiB正文上限、未flush尾段不能恢复、presentation policy非provider身份映射保持。capability=false不代表未产生typed stream引用，生产集成须核旧timeline消费者不会误读通用detail。

Nonblocking后继REQ15/17：store每patch读取并重哈希已有prefix，累积DB读取为O(n²)；本次wire逻辑bytes样例不证明DB容量。计划CHAT06-07保留独立后继，不扩本片或S01，不为此重跑原始证据。Owner接受上述边界，源码保持停写，等待Lead集成。

## 授权消费者组合（2026-10-06 06:57:05 UTC）

原领域APPROVED target5ff8880b3518992121216998c169dd01ab44cee0保持。唯一后续源差异是test-only d9a162738c5c3b3531fc7f5da3a5c0ea1e846e67：HTTP timeline无stream ref，但PG原typed ref仍保存。assignment_review明确确认C02 fixed77f0b152a2be32806b17cc7f8a57d33afc2043b3 APPROVED含此4行及consumer-final.txt的1/1、18未选证据，未削弱原持久断言；不是本轮重审或重跑原72。该组合批准由唯一owner转录，领域代码未动，不把d9冒称原领域target。

## 组合锚点（2026-10-06 07:14:54 UTC）

当前Review target commit对应组合d9a162738c5c3b3531fc7f5da3a5c0ea1e846e67，不新增或扩展旧批准：Root批准5ff8880b3518992121216998c169dd01ab44cee0完整领域；assignment_review在77f0b152a2be32806b17cc7f8a57d33afc2043b3独立批准中明确包含d9的四行stream.test消费者差异，并核实际1/1（18未选）。d9相对已审领域只改变该消费者测试，其他领域源码相同。原72条/tsc仍绑定5ff；本次没有重跑或新的独立审批。Lead经Root授权允许仅metadata校准此可核验组合锚点，不改范围、parser或测试。
