# PERF02 Activity 窗口候选证据

实现 `a87f64f48a3b7e8d03429ab0673c210076a2df0d`；base `cc33403cd9b357fcd85484b7bc6952dc1220d689`。作者13 tests/typecheck、8功能browser与smoke+3正式矩阵全部通过；独立审查 **APPROVED** target `a87f64f48a3b7e8d03429ab0673c210076a2df0d`；[范围和实际独立检查](../../../plans/wpf-perf02-activity-window/review.md)，main未集成。

- [性能结果与全部限制](results.md)、[原始汇总](summary.json)、[协调窗口](measurement-window.json)。
- [浏览器](window-browser.json)：8组实际普通production功能行为，Chrome154，动态HTTP fixture，无模型调用。
- [完整性](window-integrity.json)：1040变高记录逐窗口全量id/cursor/body hash，maxMounted16。
- [浅色390](window-light-narrow.png)、[深色390](window-dark-narrow.png)、[深色桌面](window-dark-desktop.png)。
- [质量](quality.md)、[开发失败](development-failures.md)、[D04原receipt](take-receipt.json)。

复现：Node24、pnpm9.15.4，本树既有依赖；`pnpm exec vitest run apps/web/test/workspace-window.test.ts apps/web/test/workspace-projection.test.ts`；`pnpm --filter @flow/web typecheck`；`pnpm exec tsx apps/web/test/workspace-window.browser.ts`。浏览器脚本只用临时build/动态端口并finally关闭。

新probe命令为 `pnpm exec tsx apps/web/test/performance-probe.ts --smoke` 及默认完整矩阵，结果仅本evidence；不要与其他owner基准并行。PERF01原始结果在其目录原样保留。本批无常驻预览URL。
