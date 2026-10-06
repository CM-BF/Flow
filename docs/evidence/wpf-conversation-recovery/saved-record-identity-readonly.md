# rec4d两条Restore：固定身份只读调查

固定19源 `4d3303d7e107b400ebe8ecae62b8d843c0d1d4cb`；当前metadata `12955f7d5230ad3ec5f155024bf59eaeb7410d32` clean，19 current=fixed，逐SHA256见manifest.json。仅读六个相关固定blob；root负责cleanup/raw完整审计，本报告不重复。以下路径相对apps/web/src，browser路径为apps/web/test/conversation-recovery.browser.ts。

## 已知事实与未定因果

- 实际rec4d browser.json明确：Saved drafts and receipts对话框中，按“Saved draft”及相同 `conversation:c192b9dc-0c59-4ee2-8348-cccaab574945` 过滤后，Restore without sending严格定位匹配2按钮。cookieRead PASS、textIntentDraft FAILED、pageErrors=[]；没有两record的完整ID/data/version快照，也没有保存本次变量draftId。不能断言两个都是空稿、重复数据库key，或自动保存是本次唯一来源。
- `recovery/journal.ts:5–8,77,190–202`：真正存储身份是namespace+record.id；draft.id=`draft:${owner.viewKey}`，CAS基于该id/version。routeId是owner元数据，不是唯一草稿键。不同viewKey可以合法指同route；list列当前已认证namespace全部record，不按route去重。同namespace同id的save是替换，不是新增两个键。
- `App.tsx:397–398,433–465,497–506`：views/drafts是当前Workspace的内存Map；reload按hash打开conversation，未带restoredKey时产生新crypto.randomUUID。旧durable草稿不会因此删除。`session.ts:202–213`知识binding通知、`ConversationThread.tsx:182–188`composer通知，经`App.tsx:1099–1101`接`RecoveryWorkspace.changed`；`binding.tsx:187–206`保存完整当前稿，没有“文本空就跳过”规则。因此**旧原稿A与reload新视图B的保存稿共存**是具体可达候选；空文本也可能有intent/profile/材料，不能擅自丢。
- `App.tsx:679–693`显式认识reload的新empty placeholder：先检查protectedReasons，再释放内存placeholder并以saved owner.viewKey重建；`session.ts:230–238`/`binding.tsx:395–398`只清本页binding/状态，不删durable记录。另一个浏览器tab、回收后重开同route也可产生新viewKey。它们是源码推断，不是本次raw分别证明的时序。

## 已确定的呈现/定位缺口

`RecoverySurface binding.tsx:411–414`仅把record.id当React key，用户所见标题只有kind/phase+route，每行按钮同名；key不会输出为DOM身份。合法的同route不同稿在这里不可区分。测试 `browser.ts:391–395`已从精确正文取得draftId并核原两附件，但`:398–399`和`:441`丢掉该身份，退回route定位；后续`:435,442–444`又按draftId校验，意图一直是恢复同一个原稿。

最窄建议不是去重或改变journalauthority，而是同一binding里的小呈现改动：

1. 每row公开受控的非秘密record identity（例如`data-recovery-record-id={record.id}`），仍留React key；只在现已授权namespace下渲染，不把namespace/token/CSRF放属性。测试以已有draftId精确定位该row，先assert count1、kind/route/可见摘要，再点其原Restore按钮。398和441两入口都要改，不能first/nth/remove其它record、改draftId或换成当前新稿。
2. 用户可见且程序可读的有界摘要：本地保存时间、text短预览/“无正文”、intent与已选材料数量；可展开完整本地record ID作最终区分。时间来自已有updatedAt，不宣称中心时间或唯一排序；文本/时间/摘要可能相同，不能成为唯一测试键。用纯文本渲染、Unicode安全限长；不预取附件/knowledge正文，不把整个frozen body塞ARIA名称。
3. 从record.data读取显示字段要防未知/坏shape，使用只读有界检查并fallback“详情需核验”，不能render抛错让全部记录消失，也不能为画摘要改变/规范化原data。保存时间可能不适合Date显示，需安全fallback。这里只是解释现有数据，不新增摘要模型/持久字段/第二状态机。

**只加隐藏ID的两行修补足以消除strict歧义，却不满足用户辨认同route稿的需要。** 建议先完成这个小的render-only区分和两个exact locator，再源码审、获得新gate后验；无需先设计全量草稿浏览器，也无需改storage键/删除策略/App恢复authority。具体行数不作目标，不把长JSX硬挤两行。

## 修复后的必要检查条件（本次均未运行）

- 保两个同route记录，用户能看到不同稿信息；原draftId row恰1，按钮仍调原 `workspace.restore(record)`。若副本摘要相同，仍能通过完整identity区分，不按数组顺序认稿。
- reload与第二tab都用同一draftId；完整text/Queue intent/A,B引用及顺序、原noPOST/no-content-prefetch、CAS冲突保护断言全保。被选record缺失/版本变动继续明确失败，不退选其它稿。
- 受保护placeholder不能为测试强删。Restore当前仍按record.version/generation/namespace/完整稿lease核（binding.tsx:310–367）；若精确选原record之后出现真实冲突，保原失败再调查，不放宽门禁。
- 可在后续既有raw增一个有界、非秘密record identity快照（id/viewKey/route/version、文本是否为空/材料计数），作为歧义因果证据；不导出全部正文，不把它代替真实UI点击。是否加该诊断由原scope派工决定。

本段复用既有find-skills/clean-code方法，单一identity与呈现责任分清、错误不吞、测试不绕门禁。0实现/项目记录写入、0import/tests/HTTP/PG/Chrome/free/个人服务；没有gate或重试。结论供root/manager决定原21内最小修复，未获写派工前继续冻结。
