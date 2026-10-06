# WPF-P01 独立审查

**NOT_STARTED（整体） / APPROVED（五模块）**。root独立复审3d8121006fea24b6b9f25457eb363a10110781ad五模块通过；整体target d81075c1220fc0305bf698d84823caa4877c2d89待审。原W01 approval不覆盖本任务。

- Target：`d81075c1220fc0305bf698d84823caa4877c2d89`（完整host/UI）。
- Base：`c8900a6fdbca20e683fda6fc808c135f0569c116`；输入main8c57与已审W01a22ae38。
- Worktree：`/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-host`；branch `codex/web-plugin-host`。
- Scope：新增plugins模块、plugin-host tests、WPF-P01计划与证据。App挂载由M02 owner独立集成。
- Criteria：见plan的生命周期/ID/API版本/动态权限/错误隔离/清理/窄订阅/真实builtin/sample/双主题键盘/失败恢复验收。
- 已执行：owner14模块/8browser/typecheck/fixture build；root五模块14tests与修复diff独立复审。未执行：整体UI独立review与M02 App接入。
- Findings/severity/blocking：未评估，不等于无问题。
- 作者回应/修复commit/复审：等待独立结论，必须绑定完整SHA。

```text
只读审查WPF-P01。先核branch/worktree/base/head/dirty，阅读AGENTS/plans规则和本plan/status/review；结论绑定实际target SHA。通过公开host接口复核注册不load、并发激活、原子rollback、disable/generation、异常dispose继续、动态授权/旧context拒绝、async/event与render错误隔离、immutable窄订阅。确认两个builtin是真实组件且sample不改核心可加button/tab/menu；运行模块+直接依赖checks和隔离browser fixture。确认同realm可信范围未被夸大为第三方隔离，scope未触App/Thread/workspace/shared contracts。App最终接入需M02单独证明。只读finding交owner修复，不自行修改源码或批准未知提交。
```

## PH-R1 — subscription错误隔离

P2 blocking，target2dad8cac：插件navigation/theme listener同步throw可中断App store fan-out，第二插件收不到更新且无归属diagnostic。Root独立复现并独立重跑原12tests通过。owner接受，捕获同步throw和async reject、记录subscription归属、继续分发并保留disable清理；新增store真实通知回归。修复SHA与复审待更新。

## PH-R2 — manifest仅接受自有slot键

P2 blocking，target2dad8cac：in运算接受toString/constructor原型属性为slot/event。Root独立证实。owner改Object.hasOwn，public register回归覆盖unknown、toString、constructor、__proto__的slot/activation event原子拒绝与registry不增加。修复后待独立复审。

## 模块复审（root / GPT-6只读，2026-10-06）

APPROVED，target3d8121006fea24b6b9f25457eb363a10110781ad，仅host/index/types/validation及plugin-host.test.ts五文件。Root独立重跑14tests PASS、核对目标diff为空；PH-R1和PH-R2均CLOSED，订阅错误归属隔离且后续fan-out继续，原型slot/event原子拒绝。该结论不覆盖后续UI/builtin/fixture或M02主App。metadataHEAD不自动继承实现审查。
