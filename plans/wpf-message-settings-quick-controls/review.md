# WPF-MESSAGESETTINGS02 独立审查

状态：CHANGES_REQUESTED。更新时间：2026-10-06 22:25:49 UTC。

- 当前 Target：7615ce4b89e290c42917f91f0a119c14e95e27d8；base c8e2e9e56af4c3dd2975253e9e374f9ec3e09e05。本次 fixture/browser delta 等待独立复审；作者不自批。
- 历史已审 Target：35bbe76faa2128d5c1d00711fb2be3b23d54fc4f，root/peer 结论 REQUEST_CHANGES_SCOPED_VALIDATION_GAP。唯一 MSGQUICK-R3 / P2 是验收覆盖缺口，不是已证明产品错误。
- Scope：Picker 与三项 test/fixture/browser；catalog/selection/public/旧 Picker 行为保护。全部新 types/direct/browser NOT_RUN。

## 独立原件与作者回应

[root35 原件](../../docs/evidence/wpf-message-settings-quick-controls/root-35bbe-source-review.json)、[peer35 报告](../../docs/evidence/wpf-message-settings-quick-controls/peer-35bbe/report.md)、[peer audit](../../docs/evidence/wpf-message-settings-quick-controls/peer-35bbe/audit.json)。三项早期异常结果、旧 details 回调、同 pane 回焦发现为 CLOSED_SOURCE_ONLY；历史完整保留。

R3：fixture 增加明确的 profile21 会话授权，使用现 HTTP 分页和真实受控 Apply 建立 A/B/C。刷新只得前20项时 C/A/B/text 保留且 Apply 禁用；实际 after=id20 请求后仅 exact profile21 的两 tuple 可选，不自动写，明确 Apply 一次。新增源码位于原两个 test literal，其他两源与35逐字相同。实际运行仍 NOT_RUN。

## 可复制窄复审入口

`git diff 35bbe76faa2128d5c1d00711fb2be3b23d54fc4f 7615ce4b89e290c42917f91f0a119c14e95e27d8 -- apps/web/test/message-settings.fixture.tsx apps/web/test/message-settings.browser.ts`。核真实 HTTP 请求两次顺序、授权 profile21 身份、C/A/B/text/generation/commit 数和已有五场景全部保留；不得将 fixture 控制组冒生产 App。

[source manifest](../../docs/evidence/wpf-message-settings-quick-controls/source-manifest.json)、[Interface](../../docs/evidence/wpf-message-settings-quick-controls/interface.md)、[验证提案](../../docs/evidence/wpf-message-settings-quick-controls/validation-proposal.md)。checks 与主线均待后续明确准入/接收。
