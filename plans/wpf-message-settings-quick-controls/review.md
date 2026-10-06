# WPF-MESSAGESETTINGS02 独立审查

状态：UNKNOWN（完整行为未验）。更新时间：2026-10-06 22:36:57 UTC。

- 当前 Target：fe6ece131c489c79cf531a184e4cf51209f9c4a0；base c8e2e9e56af4c3dd2975253e9e374f9ec3e09e05。root 已完成限定源码复审：APPROVED_SCOPED_SOURCE_ONLY；完整行为不由此通过。
- 历史已审 Target：35bbe76faa2128d5c1d00711fb2be3b23d54fc4f，root/peer 结论 REQUEST_CHANGES_SCOPED_VALIDATION_GAP。唯一 MSGQUICK-R3 / P2 是验收覆盖缺口，不是已证明产品错误。
- Scope：Picker 与三项 test/fixture/browser；catalog/selection/public/旧 Picker 行为保护。全部新 types/direct/browser NOT_RUN。

## 独立原件与作者回应

[root35 原件](../../docs/evidence/wpf-message-settings-quick-controls/root-35bbe-source-review.json)、[peer35 报告](../../docs/evidence/wpf-message-settings-quick-controls/peer-35bbe/report.md)、[peer audit](../../docs/evidence/wpf-message-settings-quick-controls/peer-35bbe/audit.json)。三项早期异常结果、旧 details 回调、同 pane 回焦发现为 CLOSED_SOURCE_ONLY；历史完整保留。

R3：fixture 增加明确的 profile21 会话授权，使用现 HTTP 分页和真实受控 Apply 建立 A/B/C。刷新只得前20项时 C/A/B/text 保留且 Apply 禁用；实际 after=id20 请求后仅 exact profile21 的两 tuple 可选，不自动写，明确 Apply 一次。新增源码位于原两个 test literal，其他两源与35逐字相同。实际运行仍 NOT_RUN。

## 可复制窄复审入口

`git diff 35bbe76faa2128d5c1d00711fb2be3b23d54fc4f fe6ece131c489c79cf531a184e4cf51209f9c4a0 -- apps/web/test/message-settings.fixture.tsx apps/web/test/message-settings.browser.ts`。核真实 HTTP 请求两次顺序、授权 profile21 身份、C/A/B/text/generation/commit 数和已有五场景全部保留；不得将 fixture 控制组冒生产 App。

[source manifest](../../docs/evidence/wpf-message-settings-quick-controls/source-manifest.json)、[Interface](../../docs/evidence/wpf-message-settings-quick-controls/interface.md)、[验证提案](../../docs/evidence/wpf-message-settings-quick-controls/validation-proposal.md)。checks 与主线均待后续明确准入/接收。

## 后续定位窄修 2026-10-06 22:31:41 UTC

7615 R3 旅程新增一处测试定位问题：Dialog 保持打开时 Radix hideOthers 使背景 region 不在默认 role 查询中。当前 fe6ece131c489c79cf531a184e4cf51209f9c4a0 仅把这一保稿观察改为唯一 `page.getByLabel("Draft left", { exact: true })`，不关闭弹窗、不变生产 ARIA、不删值/身份/请求/次数断言；其他三源不动。Root7615初报不能单独作为批准，正式纠正与本delta复审待收。

## 当前独立结论与检查包修复

[root fe6 正式原件](../../docs/evidence/wpf-message-settings-quick-controls/root-fe6-source-and-packet-review.json)确认四源 source-only 通过，R3/locator CLOSED_SOURCE_ONLY；[7615 初报纠正](../../docs/evidence/wpf-message-settings-quick-controls/root-7615-review-correction.json)保留，历史35/7615请求变更仍按当时事实记录。

[c1 packet root P2](../../docs/evidence/wpf-message-settings-quick-controls/root-c1-packet-terminal-review.json)、[peer](../../docs/evidence/wpf-message-settings-quick-controls/peer-c1-terminal-review.md)针对终态合同，不重开产品源码。作者按允许的早完成边界方案修复：明确 cooperative handler restoration 后不保证逐文件/stdout/exit 原子性；磁盘 PASS 只是候选，必须外层实际exit0、唯一完整terminal-seal stdout、匹配binding/result/budget/step hashes、两child退出0与完整清理才能接收。旧packet完整保留；新runner待独立复审，无gate。

精确packet为 `/private/tmp/msgquick-checks-c1`，binding 在此metadata最终固定后再重绑HEAD；源码/config与外部输入hash见其manifest。默认PREPARED，types/direct/browser全NOT_RUN。源审不冒MATURE02或真实App接线完成。
