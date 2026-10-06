# WPF-QUEUE00 验证

固定实现target：5acc5b1bde23e9c587a4580da55a75340811ecdd。完整base：75a33dec228e17bbbd0d3be9fd01bc9ac18a0133。作者workspace_panels_owner / Astra Ultra。

2026-10-06 04:45 UTC：同树Node24.20.0 / pnpm9.15.4 / Vitest4.0.18；既有锁`pnpm install --frozen-lockfile`通过，锁/manifest无diff；client/contracts workspace symlinks指向本树packages，未借用旧树依赖。

- [red.log](red.log)：先加直接行为测试，再运行；26项中4项失败：旧提示归因connection、queue true snapshot拒绝、CREATE receipt拒绝、true ACK retry无法加载。旧false正常及非法值检查保留。
- [tests.log](tests.log)：修复后`pnpm exec vitest run apps/web/test/conversation-projection.test.ts apps/web/test/conversation-outbox.test.ts`，2文件35项通过（projection26/outbox9），退出0。保留未知ACK幂等/历史gap/同revision异步回复/跨连接迟到隔离；新增false/true显式paired checks。
- [typecheck.log](typecheck.log)：`pnpm --filter @flow/web typecheck`退出0。
- 实现`git diff --check`退出0；全base→metadata diffcheck仅原始日志例外：red.log84/87尾空格及red118/tests11/typecheck4末空行；raw日志保留，不清洗。两文件hash见[manifest](source-manifest.json)。上述运行时HEAD f8928c72b3a96e4ad858cb8b46dfd07feac0c3d0 + 两文件dirty；固定5acc提交后内容一致，不声称测试在提交后重跑。

公开projection seam证明false与true均保持snapshot/capabilities，CREATE/submit只用follow-up；活动turn仍禁止send且不建outbox、不读detail、不自动queue/steer/promote。malformed queue undefined/null/string/number与不支持的steer true继续错误。测试wire转换仅用于模拟尚未宽化的共享literalfalse类型；未改共享contract/client，不能代表CHAT04后台或全部Web队列功能已交付。

本片不改布局/官方Thread/App，未跑浏览器/build/真实中心，不生成新的双主题截图或新URL；既有预览不含本片，全部保留。0模型/产品DB/音频/外部服务。独立review已APPROVED；后续main 698ffcd94ae073b23bcc67f6665fb19f707a93e4 已包含，两path相同，仅Git核验无新测试。

Root独立检查（区别于作者执行）：2026-10-06 04:45:45 UTC两个直接模块35项通过（336ms）；04:48:10核固定5acc实现diffcheck0与metadata afd308 clean，完整读取两文件diff，APPROVED限reader片段。未重跑browser/build/真实中心；旧Thread两处静态文案后继UI处理。
