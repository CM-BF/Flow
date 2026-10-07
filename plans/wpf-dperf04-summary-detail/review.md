# WPF-DPERF04 独立审查

**状态：APPROVED（固定composite源码、既有实际验收与精确档案闭包；main已接收；部署限定事实另列）**

Review target commit：bc6126278c13e8c355d704dd3c371417331026b2

Base：c837b5dccaea429b0112d1c7e0c752c41334204a

Scope：apps/execution-dashboard/src/read-model.mjs, apps/execution-dashboard/src/aggregate.mjs, apps/execution-dashboard/src/server.mjs, apps/execution-dashboard/public/app.js, apps/execution-dashboard/test/summary-detail.test.mjs, apps/execution-dashboard/test/summary-detail.browser.mjs, apps/execution-dashboard/test/task-links.browser.mjs, apps/execution-dashboard/test/task-timing.browser.mjs, apps/execution-dashboard/test/local-access.browser.mjs, apps/execution-dashboard/src/status.mjs, apps/execution-dashboard/src/local-access.mjs, apps/execution-dashboard/public/local-access.js, apps/execution-dashboard/public/local-access.css, apps/execution-dashboard/public/index.html, apps/execution-dashboard/test/local-access.test.mjs, apps/execution-dashboard/test/status-timestamps.test.mjs, docs/evidence/wpf-dperf04/reentry-20261007/browser-followup-access/parent.diff, docs/evidence/wpf-dperf04/reentry-20261007/browser-followup-access/sandbox.sb, docs/evidence/wpf-dperf04/reentry-20261007/browser-followup-access/source.diff, docs/evidence/wpf-dperf04/reentry-20261007/browser-followup-access/supervisor.py, docs/evidence/wpf-dperf04/reentry-20261007/browser-followup-linksvisual/measure.py, docs/evidence/wpf-dperf04/reentry-20261007/browser-followup-linksvisual/parent.diff, docs/evidence/wpf-dperf04/reentry-20261007/browser-followup-linksvisual/sandbox.sb, docs/evidence/wpf-dperf04/reentry-20261007/browser-followup-linksvisual/source.diff, docs/evidence/wpf-dperf04/reentry-20261007/browser-followup-linksvisual/supervisor.py, docs/evidence/wpf-dperf04/reentry-20261007/browser-followup-timingvisual/measure.py, docs/evidence/wpf-dperf04/reentry-20261007/browser-followup-timingvisual/parent.diff, docs/evidence/wpf-dperf04/reentry-20261007/browser-followup-timingvisual/sandbox.sb, docs/evidence/wpf-dperf04/reentry-20261007/browser-followup-timingvisual/source.diff, docs/evidence/wpf-dperf04/reentry-20261007/browser-followup-timingvisual/supervisor.py

[root最终独审原件](../../docs/evidence/wpf-dperf04/reentry-20261007/root-final-composite-review.json)由独立reviewer对固定bc612明确APPROVED、0blocking。16产品/保护输入逐字98baf，生产保持52cdf；14归档.py/.sb/.diff原件精确纳入scope，其余85个变化被原proof规则识别为metadata。78index条目核同；3个parent-budget保持当时快照，不能因共享路径随后合法推进误判篡改。既有8份source/actual独审链完整核同，没有新产品测试或补写旧结果。

检查PASSED与审查APPROVED均限定此精确30范围；当前main 1a6f82a136a1e43213cc58adce96fa92b26ae38b已接收（[独立核验](../../docs/evidence/wpf-dperf04/main-close-20261007/root-main-intake-review.json)），原operator发布和summary194观察已记录；真实详情整页/生产性能、公共helper scratch/第二caller未验。Claim仍v4原11，不因审查scope30扩大writer权限。后续正常metadata归档不改变固定review target。原manifest保留当时待审语境，当前结论以本页及最终原件为准。

## 当前已完成独立审查

- [组合源码](../../docs/evidence/wpf-dperf04/reentry-20261007/root-cfd-composition-review.json)及[Node10/10](../../docs/evidence/wpf-dperf04/reentry-20261007/root-dperf04-composed-node-actual-review-20261007.json)：固定source、actualexit与清理。
- [Summary/Links](../../docs/evidence/wpf-dperf04/reentry-20261007/root-summary-links-actual-review.json)：9+6功能，7原图中6限定视觉接受，原首红/异常light保留。
- [Timing保护及原5组](../../docs/evidence/wpf-dperf04/reentry-20261007/root-timing-actual-review.json)：真实queued native close后新detail仍有效；首红不追溯定因，原两图仅shell。
- [后继源码/native/helper准备](../../docs/evidence/wpf-dperf04/reentry-20261007/root-followup-source-review.json)：98baf及d377parent/helper，仅retained部分采用。
- [ACCESS5/两图](../../docs/evidence/wpf-dperf04/reentry-20261007/root-access-actual-review.json)：fake-only HTTP、default context实际清理。
- [时间正文一组/双图](../../docs/evidence/wpf-dperf04/reentry-20261007/root-timing-visual-actual-review.json)：可见heading、2h、UTC、尚未完成与来源；不重复计算原5组。
- [首页窄light一组/新图](../../docs/evidence/wpf-dperf04/reentry-20261007/root-links-visual-actual-review.json)：单topbar可读，旧重复带原图与未知成因不改；不冒首屏展示全部关系。

当前各限定审查0新增blocking。新phase20383/未用24617及旧40551/19449均CLOSED，完整EOF/0drop/所有owned清理；未用额度不触发新检查。尚未验证：真实详情整页/生产速度，以及公共helper scratch/第二caller迁移。main接收和operator摘要部署观察见当前收据。执行索引与具体来源见[phase](../../docs/evidence/wpf-dperf04/reentry-20261007/followup-phase-completion.json)。

## 历史45f8及544c限定审查

原abd2产品/直接检查、b17 wrapper及populated binding的限定独审已完成，原件见下。root于2026-10-06 19:50:25 UTC对本target正式给出APPROVED_SCOPED_LIFECYCLE_SOURCE_AND_PREPARATION_NOT_RUN、0blocking，TAIL/SOFT-STOP仅SOURCE_ADDRESSED；原CHANGES_REQUESTED addendum保留为历史。21:04新增late-stop终态写P2仅重新打开/tmp父准备稿；21:10 root对544c补修限定复审通过并关闭此P2，项目七源不变。作者第二次Node7叶项+父项8/8实际通过，root已独立核原raw/cleanup。浏览器尚未运行，完整片段与main/生产验收未完成；UNKNOWN由现有parser准确表达部分结论，不改parser或冒整体APPROVED。

## 已执行独审链与限定

- root最初4fac三server模块无新增blocking，client三个P2原报告保留；6c18后继源修由root/peer限定复核，未登记claim同类P2继续由b0修。
- [panels b0e client复审](../../docs/evidence/wpf-dperf04/review-current/b0e937-client/report.md)与[fixed来源](../../docs/evidence/wpf-dperf04/review-current/b0e937-client/sources.json)：C1-U已在固定源处理，C2因果投递块未回归，0blocking；不是浏览器实跑。
- [root1441日期专测复审](../../docs/evidence/wpf-dperf04/review-current/dperf04-1441-date-root-review.json)：仅日期依赖修正，确认前述source chain无剩余blocking。
- [root abd2 Host复审](../../docs/evidence/wpf-dperf04/review-current/dperf04-abd2-host-root-review.json)与[panels复审](../../docs/evidence/wpf-dperf04/review-current/dperf04-abd2-host-peer-review.md)：0blocking，仅真实Host transport与入站断言delta；原server防护未改。
- [root第二Node实际证据核验](../../docs/evidence/wpf-dperf04/review-current/dperf04-node-second-root-review.json)：原四raw逐字相同/8PASS/2318ms/累计3950ms/cleanup确认；root没有重跑Node。浏览器动态焦点/选区/迟到响应、390双主题与生产延迟均未验。

本次归档来源均为原独立reviewer报告，无作者替代批准。已补齐[root b17](../../docs/evidence/wpf-dperf04/browser-lifecycle-repair/root-b17-source-review.json)、[manager b17](../../docs/evidence/wpf-dperf04/browser-lifecycle-repair/manager-b17-source-review.json)与[root populated binding](../../docs/evidence/wpf-dperf04/browser-lifecycle-repair/root-populated-binding-review.json)的实际限定批准。随后[root addendum](../../docs/evidence/wpf-dperf04/browser-lifecycle-repair/root-addendum.json)要求TAIL/SOFT-STOP修复；当前[fixed source audit](../../docs/evidence/wpf-dperf04/browser-lifecycle-repair/audit.json)和[私有父监督接口](../../docs/evidence/wpf-dperf04/browser-lifecycle-repair/interface.md)已由[root45f8正式复审](../../docs/evidence/wpf-dperf04/browser-lifecycle-repair/root-45f8-source-review.json)限定接受。该报告含root的静态AST与来源核对，作者本段没有运行这些检查。无浏览器执行或整体批准；GO边界于20:01已真实接受（历史原件见下），新父544c精确边界已由root按GO授权重绑；19:46机会NOT_RUN保留。

## 历史审查与当时状态（以下不代表当前待复审）

固定4fac独立源码审查为CHANGES_REQUESTED，尚无运行结果。[root原样报告](../../docs/evidence/wpf-dperf04/review-4fac/root.json)、[workspace_panels_owner报告](../../docs/evidence/wpf-dperf04/review-4fac/client.md)与[固定来源](../../docs/evidence/wpf-dperf04/review-4fac/client-sources.json)。

4fac的三个P2：领取scope原文被Markdown格式清洗；自动摘要刷新销毁已开文档/焦点；迟到响应专测未等真实投递及正文结算。root对三个服务端模块未发现新增blocking；这不是整体批准或运行通过。后继修复须绑定新target再复审，保留4fac历史。

后继候选 `6c18b81a11eece9c07dd047d28da099a0b6bbb24` 已完成对应源修复，仅app/browser两文件，尚待独立delta复审及实际行为检查；本记录不提前关闭finding。

root对6c18补充源码finding：未登记claim每次刷新仍重建阅读节点；scope原文/绝对deadline源修正确认。后继 `b0e937d53a664b3398d36a080cef1a2d4225b6f3` 修复此同类P2并增加100 scope/unknown/版本变更回归。当前仍为修复待复审，未取得运行证据。

root授权日期专测维护固定 `1441d86baa40e98f4cb81b82dcc551202973209b`：只有summary-detail.test.mjs变化，b0e app/browser原字节保持；首次行为检查仍NOT_RUN，不以此维护commit改变既有审查结论。

## 2026-10-06 16:57:00 UTC 首Node失败后的测试修复待审

后继 `abd2aff768f97350762b2eaddbe7ae6843902f48` 只改direct Host用例，source manifest已重绑；原独审CHANGES_REQUESTED历史和新UI源码复审来源不变。请求审查node:http实际Host构造、服务端入站证据、403不变、timeout/监听清理。未执行新Node/浏览器或空间采样，原1441单次1632ms失败保留。

## 2026-10-06 16:59:01 UTC 作者直接验证结果（非独审结论）

固定abd2 / 实际823071的第二次受控Node 7叶项+父项8/8、exit0，监督2318ms，cleanup完整；[原raw](../../docs/evidence/wpf-dperf04/node-second/result.json)。首1441失败保留；browser尚未运行，独审不得由作者测试代替。

## 2026-10-06 17:31:00 UTC 新监督入口待限定源码审查

见[接口和来源](../../docs/evidence/wpf-dperf04/browser-wrapper-source/interface.md)。原行为断言字节不变，只有生命周期/门禁变化；root原结构接受不替代本次固定实现审查。所有新runtime未执行，UNKNOWN保持。

## 2026-10-06 19:47:04 UTC 历史addendum回应与当时复审入口

仅只读固定 `45f8a185ad0d43543a3c9eca7a29da97ebb31ba9` 对b17的browser wrapper delta，以及 `/private/tmp/dperf-b2/supervisor.py`（sha与原bd053差异见audit）。核原业务body/六源/task-links不变，TAIL末尾观察与非ENOENT传播、SOFT-STOP普通信号/handler恢复、双ownedgroup清理和native权限差异；不要运行或沿旧gate启动。两个P2是否关闭由独立reviewer判断，作者不提前APPROVED。fullfeature仍UNKNOWN，Node8只保原abd2归因。

## 2026-10-06 21:08:38 UTC 历史父准备稿补审入口

[root late-stop addendum](../../docs/evidence/wpf-dperf04/browser-late-stop-repair/root-addendum.json)为SOURCE_PREPARATION_REOPENED_FOR_LATE_STOP。新parent SHA `544c11c8f0ff95c78f683299ab6f2758cc7f5d1de2d2fabab9af83be62f4bd4c`，[diff](../../docs/evidence/wpf-dperf04/browser-late-stop-repair/late-stop.diff)/[说明](../../docs/evidence/wpf-dperf04/browser-late-stop-repair/report.md)。独审请核handler立即失效、持久结果与实际退出判据、最终写期间迟到stop的有界补写和终态stdout，原outerfinally/双group清理/worker/预算不变；仅源码，不执行。当前未独立关闭此P2，全片仍UNKNOWN/browserNOT_RUN。GO[旧精确边界接受](../../docs/evidence/wpf-dperf04/browser-late-stop-repair/previous-exact-native-boundary-acceptance.json)真实存在，但不能直接授权新parent字节，待root按既有授权重绑。

## 历史 2026-10-06 21:11:54 UTC 当时限定结论

[root544c复审](../../docs/evidence/wpf-dperf04/browser-late-stop-repair/root-544c-source-review.json)限定APPROVED/0blocking，late-stop P2 CLOSED；原45f8七源与worker不变。[新精确边界接受](../../docs/evidence/wpf-dperf04/browser-late-stop-repair/root-544c-native-boundary-rebind.json)已真实签发。root的AST/pins核对归其独审，作者没有复跑；browserNOT_RUN，全片UNKNOWN/main未集成。只待实际调度/资源freshgate，现TMP仍PREPARED，提交后的metadataHEAD重绑不提供运行权。

## 历史组合直接结果与当时浏览器边界

cfd5 Node9叶+父10/10已由root限定独审接受：[原件](../../docs/evidence/wpf-dperf04/reentry-20261007/root-dperf04-composed-node-actual-review-20261007.json)。首summary实际FAILED，6组/0PNG，完整清理；后继1c1901ebcda1bb9a711fd75684276df009b3e3f8仅被动原生close同步，尚未复验。全片UNKNOWN，不继承直接PASS为browser/main/deploy。

## 历史浏览器中途结算

summary固定1c190为9组+2PNG PASS，关联固定c989为6组+5PNG PASS，原summary首FAILED保留；actual双次exit0/EOF与owned清理均完整。累计24464ms、余35536ms，本段raw待root独立实际核验。当前52cdfbbb177ec9c89651ebde9b82e3a5538f45f0仅新增Timing/ACCESS受监督调用适配，NOT_RUN；全片维持UNKNOWN，无main/部署结论。
