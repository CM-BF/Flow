# S01 queue chat 完整来源修复待独审

Source `f722e28678e9e9af0e631af7539e1c6f70adf7c9`，parent packet `4560188a575fbd8045683171ab65a9ff6c67e028`；本片仅三处源增量（queue-chat、直接test、既有local caller有限选择/时间与资源记录），不重审45项原包。状态 **PENDING SOURCE_REVIEW / NOT_READY / NOT_RUN / NOT_OPEN**。

原独审13:22:36对130c/456为SOURCE_CHANGES_REQUESTED：首次unavailable历史P2已CLOSED；新1P2是三字段source反例掩盖固定4fdd真实legacyReply完整DTO。正式原结论见 [queue-independent-review.json](queue-independent-review.json)，旧source/raw/manifest未覆盖。

修复按固定4fdd `replies.ts:73–75` 与公共 `ConversationArtifactReplySource`：严格kind、adapterVersion、task、attempt、artifactId/result、artifactVersion/full SHA256、detailId；同messageId、contentRef的kind/id/title/task/attempt闭合，正文、available/assistant、truncated=false保留。server首次分配detailId先经同回复一致性验证，再绑定至私有ChatProbe供后续snapshot/page拒漂移；首次自洽不是独立DB真实性证明，不冒充已跑真实HTTP。

测试用完整公共DTO，type-only satisfies公共ConversationAssistantReply；覆盖正常snapshot/page/首引用、错误正文与digest、七来源字段、旧三字段替身、详情引用/message/conversation漂移。3 selected/3 pass/14未选；focused strict0，两实际child于13:27:04.850378Z结束，工具13:27:09Z确认。两raw457B，监督累计2484ms，不是wholewall；初EPERM与全部历史失败保留。2组finalabsent/MERGED EOF、observed=retained、无signals/secondary，2TMP同inode有界末采样后删除，233/0B末样本非峰值。逐run source及fixed生产只读来源见 [单份新local记录](queue-chat-fix-local.json)。

此修复保持生产pool/SQL、v2领取、配方、取消、默认A/B不变；完整runtime/动态SQL/外层监督输入及新pool-wait-run scope仍待准备，真实PG与性能窗口未开放。本段代码与记录合计≤2MiB；无旧unknown根访问。

质量复核 2026-10-07T13:28:15.974410+00:00：已安装find-skills、codebase-design、固定clean-code复用；仅私有观察Interface核生产判别与同引用关系，无新通用decoder/监督器。错误抛出中止配方，不吞身份错误；取消/资源生命周期未改。正式P2关闭由原reviewer判断，owner不自批。
