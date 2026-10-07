# WPF-VISUAL01 共享浮层独审

当前结论：**NOT_STARTED**。target 待源码固定；base 3c9345df4aec85a37e8a2a155e079db260d515b1。

scope：apps/web/src/assistant-ui.css, apps/web/src/components/ui/dialog.tsx, apps/web/src/execution-profiles/ExecutionProfilePicker.tsx, apps/web/src/execution-profiles/execution-profiles.css, apps/web/test/conversation-recovery.browser.ts, apps/web/test/message-settings.browser.ts。核 shared Dialog 展示而非权威变更、tuple/CAS/Apply/liveness 保留、渐进层级/主操作可达、完整长身份、焦点与两种滚动条边界。工程/浏览器/视觉目前 NOT_RUN，主线/部署 NOT_INTEGRATED。

独审者先核固定 Git target、实际文件 hash 和本次检查原件，再区分 source / local / browser / visual / main / deployment；禁止继承历史 a8 绿项。原 APPROVED 历史见[historical review](../../docs/evidence/wpf-visual01/shared-overlays/historical-review.md)。
