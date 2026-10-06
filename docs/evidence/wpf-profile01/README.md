# PROFILE01 模块交付证据

固定实现 `b2b2844414172cedf8cdc663e97a0b46c6905202`，base `4e0289f29ffa48c6c49003837d4520f57c22b6b0`。本模块只负责目录、选择和冻结创建配置；现 App 尚未消费。独立review见 [review](../../../plans/wpf-profile01-execution-profiles/review.md)。

| 检查 | 作者实际结果 |
| --- | --- |
| `PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run apps/web/test/execution-profiles.test.ts` | 13/13 PASS；1文件；2026-10-06 04:42 UTC |
| `pnpm --filter @flow/web typecheck`（同Node24 PATH） | exit0 |
| `pnpm exec tsx apps/web/test/execution-profiles.browser.ts`（同PATH） | 5行为组 PASS / pageErrors=[]；Chrome154；[原始JSON](browser-results.json) |
| 隔离fixture production bundle | Vite8 build lib entry=`apps/web/test/execution-profiles.fixture.tsx`，React/Tailwind现有插件，输出 `/tmp/flow-profile01-isolated-build`；PASS。仅证明模块生产编译，不声称生产App接入或完整prod browser |
| 范围与锁 | `git diff --check` PASS；根package.json/pnpm-lock.yaml diff0；仅7新实现文件 |

13项包括实际 FlowClient HTTP分页、同模型不同runner、保留旧页错误/401恢复、append失败重试、refresh竞争/中止、dispose迟到隔离、畸形页原子拒绝（3case）、完整冻结、legacy兼容、ACK pin有无/完整字段、首次显式请求与取消订阅。UI验证20+1真实分页/503原页重试、native键盘选择、Escape焦点返回、未发送草稿保留、401陈旧门禁、dark390/reduced-motion、未知ACK无summary锁、换中心新目录和created锁。

- [浅色选择器](profiles-light.png)
- [深色390选择器](profiles-dark-390.png)
- [深色390未知回执锁](profiles-pending-dark-390.png)

截图均人工目视。首次fixture失败因自定义HTML没经 `transformIndexHtml` 导致React preamble缺失；随后textarea嵌套label定位不稳定，补明确aria-label。两项已修，最终完整5组重跑，不计早期失败为产品已通过。

## 本地查看

```sh
cd /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-execution-profiles
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/execution-profiles.browser.ts --serve
```

命令输出 `PROFILE01_HTTP_FIXTURE=http://127.0.0.1:<dynamic-port>`；交付时保留预览 `http://127.0.0.1:62662`。只提供合成 HTTP profile声明、0模型；所有冻结按钮均本地fixture控件，无POST会话。独立自动检查另用动态端口且finally关闭浏览器/服务，不占4320/49922或其他owner端口。

## 接入与限制

[完整Interface](interface.md)。调用者负责首次refresh、connection lifetime/dispose、创建时采用当前已确认的profile，以及outbox key、unknown重试原输入、ACK核对后绑定、草稿安全。当前unpicked/legacy显式兼容不表示服务在线。目录仅按页读取，缺失于loaded页不是全目录删除；旧选项绝不自动替代。中心准入再次检查ref是否可用。

未知项：真实中心/provider/runner可达、实际模型名与工具、App组合、Safari/Firefox/屏读；queue/steer/effort切换不在此合同。被冻结输入经过其他模块schema.parse可能重新变可变，消费端必须重新冻结ref/requested；这属于接入检查，不以本模块的冻对象推整个App已安全。
