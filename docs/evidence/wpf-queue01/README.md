# 聊天排队操作交付

实现：`309ec0e37bc92cc0f91d8f3bfd8f9e9f6519432c`；基线`14c61b4062f8040ba6c7239860929366e5bd3fc1`。分支`codex/web-conversation-queue`，唯一工作树`/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversation-queue`。root05:40:36固定target限定APPROVED，main尚未集成本片。

聊天执行中选择 **Queue next** 后可用官方输入框Enter或Add to queue按钮送入中心队列。等待列表支持显式分页、按需完整正文、单条取消；暂停与取消当前执行分开，继续前重新读取最新执行。旧中心queue=false不发队列请求；steer仍不可用。Queue组件为真实AI Elements官方组件选用，不负责执行、持久化或本地推进。

[计划](../../../plans/wpf-queue01-ui/plan.md) · [唯一状态](../../../plans/wpf-queue01-ui/status.md) · [审查](../../../plans/wpf-queue01-ui/review.md) · [验证](validation.md) · [技能/清码](quality.md) · [正式领取](take-receipt.json)

## 可看版本和恢复

当前专用开发预览：<http://127.0.0.1:58071/>，服务owner`workspace_panels_owner`、session3035。HTTP fixture，0模型/0真实DB；长期预览由owner保留，测试只关闭自己创建的动态端口服务。Conversation2为运行态可切Queue next；Conversation1有25条等待可分页；Conversation8模拟旧capfalse。

在本工作树运行：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/conversation-queue.fixture.ts --queue-preview
```

端口由系统分配，以stdout为准。该fixture公开token为`flow-fixture-only`，不用于真实中心。58071既有HTTPfixture启动早于最终测试注入helper（promoteOnNextCancel），产品Vite源内容等于固定target；真实浏览器自动脚本每次创建完整新fixture。保留49922、55049、63743、59473、51832、55247及现SVC/工程dashboard，无重启、替换用户tab或真实模型调用。

## 重现检查

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run apps/web/test/conversation-projection.test.ts apps/web/test/conversation-queue.test.ts
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm --filter @flow/web typecheck
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/conversation-queue.browser.ts
PATH=/opt/homebrew/opt/node@24/bin:$PATH VITE_FLOW_FIXTURE=true pnpm --filter @flow/web build
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/conversation-queue.browser.ts --production
```

以上浏览器脚本在真实App/官方Thread中使用公共FlowClient HTTP；按钮/Enter/IME、旧capfalse、未知ACK同key、pause重放→GET→独立cancel、同revision动态状态、already-promoted、分页/详情cache、跨连接迟到、reload中心恢复、390px双主题/焦点均有断言。与真实中心/真实模型联调严格分开。

## 边界

- 中心已受理waiting/paused可从GET恢复；本页面尚未确认的原key/payload仅在内存，同页offline/online保留，reload或更换连接会失去。F01 journal/无凭据稳定namespace后继仍pending，不能凭相同正文GET猜受理，也不会自动新key重发。
- Pause只停止队列未来推进，不撤销当前执行；任务cancel单独请求/单独receipt，已做工作不回滚。发送超时/丢ACK不等未受理。
- 不支持steer、编辑/移动等待项、流式assistant正文、自由model/thinking/access组合、跨刷新持久草稿、声音或PTY。
- 构建仍报告两个>500kB chunk，不宣称整体性能预算通过。固定版本独立review与main集成由root/MainLead另记。
