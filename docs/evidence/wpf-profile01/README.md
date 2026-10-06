# PROFILE01 模块交付证据

当前固定target `4f1985769564eafad9218570411d5ce1114b4ec0`，源码base `4e0289f29ffa48c6c49003837d4520f57c22b6b0`；只读后继合同 `02683be019ae75591b21c1ada64e01669678f068`。旧a28的限定approval保留历史，新适配独审见[review](../../../plans/wpf-profile01-execution-profiles/review.md)。实际App尚未消费。

| 检查 | 作者实际结果 |
| --- | --- |
| `PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run apps/web/test/execution-profiles.test.ts` | target4f，16/16 PASS；1文件；2026-10-06 04:50 UTC |
| `pnpm --filter @flow/web typecheck`（同PATH） | target4f exit0 |
| `pnpm exec tsx apps/web/test/execution-profiles.browser.ts`（同PATH） | target4f，5行为组 PASS/pageErrors=[]；Chrome154；[原始JSON](browser-results.json) |
| 范围/锁 | diffcheck0；根manifest/lock与共享文件无变；五文件后继差异均已领取 |
| 历史隔离fixture production bundle | b2时Vite8 lib entry=test/execution-profiles.fixture.tsx输出/tmp/flow-profile01-isolated-build通过；不是4f重跑/不是App集成；后继按影响执行type/unit/browser未重跑无关build |

16项覆盖真实FlowClient HTTP分页/同model不同runner、保留页错误/401恢复、append失败重试、refresh中止竞争、dispose迟到隔离、畸形页原子拒绝（3case）、完整冻结、legacy兼容、ACK完整pin、显式首次请求和取消订阅、混合合法+goal-tools+unknown页仍可分页/合法选择、直接configured及freeze入口拒绝非chat、已知goal-tools两种策略无效整页失败。

5个HTTP浏览器组验证20+1混合目录、goal-tools/unknown显示原因并禁选、键盘跳过禁选、503原页重试、401旧页与选择保留/恢复、Escape焦点返回/未发送草稿保留、深色390/reduced-motion、未知ACK无summary锁、换中心/created锁。0模型/0数据库。

- [浅色混合目录](profiles-light.png)
- [深色390混合目录](profiles-dark-390.png)
- [深色390未知回执锁](profiles-pending-dark-390.png)

截图已人工目视。早期b2 fixture漏Vite HTML变换及textarea accessible name问题已修且后续完整重跑，未隐瞒初次失败。当前4f未遇新增检查失败。

## 本地查看

```sh
cd /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-execution-profiles
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/execution-profiles.browser.ts --serve
```

输出 `PROFILE01_HTTP_FIXTURE=http://127.0.0.1:<dynamic-port>`；当前保留 `http://127.0.0.1:64954`（混合目录fixture）。旧62662已核自己PID/cwd后清理，不碰别的服务。自动检查另开动态端口并finally清理。冻结按钮仅本地fixture，无会话POST或模型；未改4320/49922。

## 接入与未验证

[Interface](interface.md)。DirectoryProfile只是声明，只有allowlist产生ChatProfile；未知access不推目的或可用。已知goal-tools无审批/空材料策略继续严格。中心准入再核ref，UI不保证在线。

未验证实际App组合、真实center/runner/provider/模型、Safari/Firefox/屏读。queue/steer/effort切换不在此合同。App outbox再次parse后ref需重新冻结；unknown原key/body重试与草稿安全由接入owner在独立claim验证。旧a28批准不能自动覆盖新合同或后续App。
