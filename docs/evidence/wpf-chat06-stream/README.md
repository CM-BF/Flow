# WPF-CHAT06S01 交付入口

实现 `3ac11cba14ce8baac3b3a769c19827f6343ca4a7`，基线 `fa9a8288341d4f2bd8160e03fe9173dafa2de1a6`。独立模块提供已协商的 assistant patch 正文累计、有界读取与官方 Thread 消息适配；尚未接入产品 App。

- [计划](../../../plans/wpf-chat06-stream/plan.md)、[唯一状态](../../../plans/wpf-chat06-stream/status.md)、[独立审查入口](../../../plans/wpf-chat06-stream/review.md)
- [消费接口与后继UI职责](interface.md)、[验证与失败历史](validation.md)、[技能及clean-code](quality.md)
- [固定输入](input-provenance.json)、[原领取回执](take-receipt.json)、[检查运行来源](checks.json)、[实现源码绑定](source-binding.json)

本片没有网页、截图或新服务；现存用户预览全部保留。后继 App owner 需私有绑定 reader 到 connection/view/conversation/turn/task，按可见 pane 预算更新 host；只 GET conversation opt-in `patch-v1`，CREATE ACK 仍 false。正文展示必须明确暂停/中断/截断/非最终，不能把块结束当任务或验证成功。该接线待 ActivityI 正式交权、独立 take，不能复制此模块为第二消息管线。

复现作者局部检查（Node 24 / pnpm 9.15.4）：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run apps/web/test/conversation-stream.test.ts apps/web/test/conversation-stream-projection.test.ts
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm --filter @flow/web typecheck
```

0 模型、DB、真实服务操作；未验证 provider 首 token、真实HTTP、App接线、浏览器体验或整体性能预算。实现只新增三模块和两直接测试，不修改共享协议、FlowClient、官方 Thread、旧会话投影或根依赖。架构影响及固定 target 已交协调者，待后继架构快照更新。
