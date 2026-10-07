# WPF-VISUAL01 共享浮层独审

当前结论：**NOT_STARTED**。target `5f8984d69e22f6c3a105f9adbaf9ba671cab96d3`；base 3c9345df4aec85a37e8a2a155e079db260d515b1。

scope：apps/web/src/assistant-ui.css, apps/web/src/components/ui/dialog.tsx, apps/web/src/execution-profiles/ExecutionProfilePicker.tsx, apps/web/src/execution-profiles/execution-profiles.css, apps/web/test/conversation-recovery.browser.ts, apps/web/test/message-settings.browser.ts。核 shared Dialog 展示而非权威变更、tuple/CAS/Apply/liveness 保留、渐进层级/主操作可达、完整长身份、焦点与两种滚动条边界。工程/浏览器/视觉目前 NOT_RUN，主线/部署 NOT_INTEGRATED。

独审者先核固定 Git target、实际文件 hash 和本次检查原件，再区分 source / local / browser / visual / main / deployment；禁止继承历史 a8 绿项。原 APPROVED 历史见[historical review](../../docs/evidence/wpf-visual01/shared-overlays/historical-review.md)。

固定源码包括六源；[字节清单](../../docs/evidence/wpf-visual01/shared-overlays/source-manifest.json)与[权威逻辑保留核对](../../docs/evidence/wpf-visual01/shared-overlays/static-preservation.json)。作者自检发现旧额外筛选键盘Tab顺序需新增一个真实disclosure站点，已在原browser中适配；旧六组业务断言保留。此为作者静态检查，不是独立APPROVED或运行通过。
