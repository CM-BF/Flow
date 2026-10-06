# 局部验证

实现target `889f433ef6972e4feee95aa878f0dbaf7da30448`，基线86a36eaeffbf09f0a3772c3d1509c17dc0a76f92。Node24.20.0/pnpm9.15.4/Vitest4.0.18，已有依赖offline/frozen安装3.5s，[安装原日志](install.log)，根manifest/lock无diff。

- 修改前：[red-direct.log](red-direct.log)，07:02:40Z，44项中10失败/34通过，564ms。其中8项暴露旧guard拒绝filtered scan或宽松reset；2项为作者新测试it.each数组被展开为对象导致entries.at错误，不把这两项算产品复现。
- 第一次修复后：[first-green-direct.log](first-green-direct.log)，07:04:41Z，42通过/2失败，516ms；两个it.each参数问题仍在。随后改用对象参数并显式包为entries数组，未再改变产品代码。
- 最终：[green-direct.log](green-direct.log)，07:04:58Z，44/44通过，214ms，tests15ms。命令 `pnpm exec vitest run apps/web/test/conversation-activity.test.ts`。
- [typecheck.log](typecheck.log)：`pnpm --filter @flow/web typecheck` exit0。未执行全库/浏览器/build/HTTP服务/DB/model，无视觉/UI变化，不开新预览。

[checks.json](checks.json)原样记录当时HEAD1e49fe4+dirty与两个源SHA256；实现提交在检查后创建，通过同hash绑定target，不能称测试在后来的metadata HEAD执行。[输入来源](input-provenance.json)核C02 manifest声明的compatibility.test SHA256一致；用固定309be包含77f的HTTP/SSE断言映射contract fixtures。此处实际运行真实ConversationActivityProjection、mock ActivityPort；不是历史raw capture，不冒充重新运行C02真实HTTP/PG。

新增22项保留原22项：after1空页next3→ordinary5，raw33→离线恢复ordinary37，visible+filtered尾页，终末空页，exhausted同cursor显式刷新，已知重复去重，task/顺序/entry上界/next范围/hasMore矛盾/after倒退，旧记录payload/cursor冲突及unknown旧cursor拒绝，reset必须after>watermark与结构限制。首读/隐藏/详情按需0请求、缓存/代际等原用例全部保留。

07:03:30–07:04:30Z遵守GO性能静默：安装和红测此前已自然结束；窗口内只源码/文档，无新测试/服务动作；恢复实际07:04:41Z。

实现两文件diffcheck0；packages/server/runner/App/Thread/锁与包依赖均未改。原始日志保留字节，完整metadata diffcheck非零仅原始日志EOF空行：first-green-direct.log:66、green-direct.log:10、red-direct.log:239、typecheck.log:4；保留原字节不清洗。排除这些raw logs的source/docs diffcheck0。main尚未集成。


独立review补充：root固定889f433 APPROVED；完整审读两源，07:05:41Z独立44/44 PASS（543ms），两源hash与checks/target/当前一致，86a与ba908原文件一致，source diffcheck0。作者tsc由root读取证据，未独立重跑；无新server/browser/DB/model。详情见[review](../../../plans/wpf-activity-cursor-compatibility/review.md)。
