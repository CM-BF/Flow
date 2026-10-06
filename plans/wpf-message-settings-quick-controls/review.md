# WPF-MESSAGESETTINGS02 独立审查

状态：UNKNOWN（完整行为未验）。更新时间：2026-10-06 23:21:55 UTC。

- 当前 Target：fe6ece131c489c79cf531a184e4cf51209f9c4a0；base c8e2e9e56af4c3dd2975253e9e374f9ec3e09e05。root 已完成限定源码复审：APPROVED_SCOPED_SOURCE_ONLY；完整行为不由此通过。
- 历史已审 Target：35bbe76faa2128d5c1d00711fb2be3b23d54fc4f，root/peer 结论 REQUEST_CHANGES_SCOPED_VALIDATION_GAP。唯一 MSGQUICK-R3 / P2 是验收覆盖缺口，不是已证明产品错误。
- Scope：Picker 与三项 test/fixture/browser；catalog/selection/public/旧 Picker 行为保护。全部新 types/direct/browser NOT_RUN。

## 独立原件与作者回应

[root35 原件](../../docs/evidence/wpf-message-settings-quick-controls/root-35bbe-source-review.json)、[peer35 报告](../../docs/evidence/wpf-message-settings-quick-controls/peer-35bbe/report.md)、[peer audit](../../docs/evidence/wpf-message-settings-quick-controls/peer-35bbe/audit.json)。三项早期异常结果、旧 details 回调、同 pane 回焦发现为 CLOSED_SOURCE_ONLY；历史完整保留。

R3：fixture 增加明确的 profile21 会话授权，使用现 HTTP 分页和真实受控 Apply 建立 A/B/C。刷新只得前20项时 C/A/B/text 保留且 Apply 禁用；实际 after=id20 请求后仅 exact profile21 的两 tuple 可选，不自动写，明确 Apply 一次。新增源码位于原两个 test literal，其他两源与35逐字相同。实际运行仍 NOT_RUN。

## 可复制窄复审入口

`git diff 35bbe76faa2128d5c1d00711fb2be3b23d54fc4f fe6ece131c489c79cf531a184e4cf51209f9c4a0 -- apps/web/test/message-settings.fixture.tsx apps/web/test/message-settings.browser.ts`。核真实 HTTP 请求两次顺序、授权 profile21 身份、C/A/B/text/generation/commit 数和已有五场景全部保留；不得将 fixture 控制组冒生产 App。

[source manifest](../../docs/evidence/wpf-message-settings-quick-controls/source-manifest.json)、[Interface](../../docs/evidence/wpf-message-settings-quick-controls/interface.md)、[验证提案](../../docs/evidence/wpf-message-settings-quick-controls/validation-proposal.md)。checks 与主线均待后续明确准入/接收。

## 历史定位窄修 2026-10-06 22:31:41 UTC

7615 R3 旅程新增一处测试定位问题：Dialog 保持打开时 Radix hideOthers 使背景 region 不在默认 role 查询中。当前 fe6ece131c489c79cf531a184e4cf51209f9c4a0 仅把这一保稿观察改为唯一 `page.getByLabel("Draft left", { exact: true })`，不关闭弹窗、不变生产 ARIA、不删值/身份/请求/次数断言；其他三源不动。Root7615初报不能单独作为批准，正式纠正与本delta复审待收。

## 四源结论与历史检查包修复

[root fe6 正式原件](../../docs/evidence/wpf-message-settings-quick-controls/root-fe6-source-and-packet-review.json)确认四源 source-only 通过，R3/locator CLOSED_SOURCE_ONLY；[7615 初报纠正](../../docs/evidence/wpf-message-settings-quick-controls/root-7615-review-correction.json)保留，历史35/7615请求变更仍按当时事实记录。

[c1 packet root P2](../../docs/evidence/wpf-message-settings-quick-controls/root-c1-packet-terminal-review.json)、[peer](../../docs/evidence/wpf-message-settings-quick-controls/peer-c1-terminal-review.md)针对终态合同，不重开产品源码。作者按允许的早完成边界方案修复：明确 cooperative handler restoration 后不保证逐文件/stdout/exit 原子性；磁盘 PASS 只是候选，必须外层实际exit0、唯一完整terminal-seal stdout、匹配binding/result/budget/step hashes、两child退出0与完整清理才能接收。旧packet完整保留；新runner待独立复审，无gate。

精确packet为 `/private/tmp/msgquick-checks-c1`，binding 在此metadata最终固定后再重绑HEAD；源码/config与外部输入hash见其manifest。默认PREPARED，types/direct/browser全NOT_RUN。源审不冒MATURE02或真实App接线完成。

## 当前静态准备批准与后置浏览器

[root c1 final](../../docs/evidence/wpf-message-settings-quick-controls/root-c1-final-preparation-review.json)批准终态修复，仅静态准备；c1实际types/direct26仍NOT_RUN。四源不变。独立浏览器 `/private/tmp/msgquick-b1` 复用方法、全新任务/claim/0累计绑定，真实CSS+6组场景+2PNG，nativeChromeBoundaryApproval 与 typesDirectEvidence 均 null，PREPARED/无gate。须先c1真实exit+seal/结果被接收，再新Chrome边界与fresh准入；旧Settings01四项PASS/预算/边界不继承。

[浏览器准备](../../docs/evidence/wpf-message-settings-quick-controls/browser-preparation/report.md)、[固定消费者闭包](../../docs/evidence/wpf-message-settings-quick-controls/root-browser-consumer-scope.json)。此轮档案存declared inputs；TMP actualHEAD在本metadata固定后统一重绑，不由档案预授运行。

## 本地浏览器与可移植候选限定静态已审

[root b1](../../docs/evidence/wpf-message-settings-quick-controls/root-b1-preparation-review.json)限定静态通过，未运行/无gate，原生Chrome边界与同fe6 c1真实结果仍为前置。当前c1/b1保持原字节。

Portable review：**APPROVED_SCOPED_PORTABLE_PREPARATION_NOT_RUN / 0 blocking**。固定候选 `dc67b3410c12f321d62a1565145e184b52b0ca84`，仅 [manifest](../../docs/evidence/wpf-message-settings-quick-controls/portable-candidate-manifest.json) 的9证据文件；产品fe6四源不变。核相对type/JS真实解析、117输入、26展开名、实际child结果/有界JSON/外层信任回执及失败清理职责。有限三语法与14alias纯表达式检查通过，不是types/direct。不得执行候选或移植本地已审结论为远程通过。

[root dc67 原件](../../docs/evidence/wpf-message-settings-quick-controls/root-dc67-portable-preparation-review.json)、[peer失败路径原件](../../docs/evidence/wpf-message-settings-quick-controls/peer-dc67-portable-failure-review.md)已原样归档。独审只读核117输入/9candidate/7prepared/4fe6/26names与两本地包manifest；没有执行types/direct/browser。当前外层审查结论覆盖固定dc67；候选目录README及原manifest的NOT_STARTED保留其送审时历史字节，不改已审候选。运行仍需本机资源和独立准入，remote未启用、外层隔离与真实cleanup责任仍归未来CI owner。
