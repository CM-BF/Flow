# WPF-VISUAL01 共享浮层独审

当前结论：**APPROVED_SCOPED_TYPES / BROWSER_PENDING**（517678仅接受窄guard与affected类型实际；不是全片APPROVED）。target `4ca1deac319afac89f7c0ae5e0142cb9de429a2a`；base 3c9345df4aec85a37e8a2a155e079db260d515b1。

scope：apps/web/src/assistant-ui.css, apps/web/src/components/ui/dialog.tsx, apps/web/src/execution-profiles/ExecutionProfilePicker.tsx, apps/web/src/execution-profiles/execution-profiles.css, apps/web/test/conversation-recovery.browser.ts, apps/web/test/message-settings.browser.ts。核 shared Dialog 展示而非权威变更、tuple/CAS/Apply/liveness 保留、渐进层级/主操作可达、完整长身份、焦点与两种滚动条边界。四入口affected类型复验PASSED、首FAIL保留；浏览器/视觉目前 NOT_RUN，主线/部署 NOT_INTEGRATED。

独审者先核固定 Git target、实际文件 hash 和本次检查原件，再区分 source / local / browser / visual / main / deployment；禁止继承历史 a8 绿项。原 APPROVED 历史见[historical review](../../docs/evidence/wpf-visual01/shared-overlays/historical-review.md)。

固定源码包括六源；[字节清单](../../docs/evidence/wpf-visual01/shared-overlays/source-manifest.json)与[权威逻辑保留核对](../../docs/evidence/wpf-visual01/shared-overlays/static-preservation.json)。作者自检发现旧额外筛选键盘Tab顺序需新增一个真实disclosure站点，已在原browser中适配；旧六组业务断言保留。此为作者静态检查，不是独立APPROVED或运行通过。

## 本次 preset 源码差量

旧六源的[root source notes](../../docs/evidence/wpf-visual01/shared-overlays/root-source-notes.json)为 SOURCE_NOTES/无 blocking，不是最终 APPROVED。当前新增 parent preset 静态限定 appearance、自有 evidence/runs、独立60s/30s清理，保默认MSG与全部worker断言。该preset差量已获 [f29a限定静态审](../../docs/evidence/wpf-visual01/shared-overlays/validation-prepared/root-preset-review.json)；affected noEmit已实际通过，browser仍NOT_RUN；[保存核对](../../docs/evidence/wpf-visual01/shared-overlays/validation-prepared/static-preservation.json)。

## 必要类型实际

[两次原件与冻结输入](../../docs/evidence/wpf-visual01/shared-overlays/types-actual/index.json)及[单一累计账](../../docs/evidence/wpf-visual01/shared-overlays/types-actual/phase.json)。首红只有HTMLElement联合类型和精确声明路径问题；新增HTMLElement guard与3个d.ts路径后复验0。原期望、CSS、所有业务断言与运行器生命周期不变。5765/30000ms CLOSED；浏览器与图片仍未验。

## 当前准备安全点

[root517678](../../docs/evidence/wpf-visual01/shared-overlays/types-actual/root-review.json)已原样归档。当前Picker新parent/worker差量仍待集中source/native审，Recovery完整resolver/link supply尚未ready；无新增实际检查。[准备报告](../../docs/evidence/wpf-visual01/shared-overlays/browser-prepared/report.json)。

## 2026-10-07 Recovery完整准备

Picker [f3b8限定源码准备审](../../docs/evidence/wpf-visual01/shared-overlays/browser-prepared/root-picker-source-review.json)无blocking，非browser结果/native实际许可。Recovery当前[可审包](../../docs/evidence/wpf-visual01/shared-overlays/recovery-prepared/README.md)固定38links/JS+CSS+SQL/native输入，源/native集中审尚待；首批未物化状态留历史。原六源与已绿types未改/未重跑。

## peer差量当前边界

[abb32](../../docs/evidence/wpf-visual01/shared-overlays/recovery-prepared/root-preparation-review-with-peer-hold.json)已限定接受原614 own/406 roots/38 links/capture，依赖HOLD不回填。当前新[4peer与2必要声明依赖索引](../../docs/evidence/wpf-visual01/shared-overlays/recovery-prepared/closure-index.json)待delta确认；412总roots固定不等于实际运行通过。capture/parent与产品六源没有再次修改。
