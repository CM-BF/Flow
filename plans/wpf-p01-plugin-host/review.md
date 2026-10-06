# WPF-P01 独立审查

**CHANGES_REQUESTED（整体） / APPROVED（五模块）**。root独立复审3d8121006fea24b6b9f25457eb363a10110781ad五模块通过；整体target 6ce3ba0a41d51f26cd6fbceddfbb2f80e4931bd6复审中。原W01 approval不覆盖本任务。

- Review target commit：`6ce3ba0a41d51f26cd6fbceddfbb2f80e4931bd6`（完整host/UI）。
- Base：`c8900a6fdbca20e683fda6fc808c135f0569c116`；输入main8c57与已审W01a22ae38。
- Worktree：`/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-host`；branch `codex/web-plugin-host`。
- Scope：新增plugins模块、plugin-host tests、WPF-P01计划与证据。App挂载由M02 owner独立集成。
- Criteria：见plan的生命周期/ID/API版本/动态权限/错误隔离/清理/窄订阅/真实builtin/sample/双主题键盘/失败恢复验收。
- 已执行：owner15模块/12browser/typecheck/fixture build；root五模块14tests与修复diff独立复审。未执行：整体UI独立review与M02 App接入。
- Findings/severity/blocking：PH-R1/R2/R3 CLOSED；PH-R4 P2 blocking修复中，待新target独立复审。
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

## PH-R3 — sample panel桥失败可见性

P2 blocking，targetd81075c：Notes useState记录error但未渲染，root CUA5190实际勾Fail App bridge→Use Ocean theme后alerts为空。owner接受，增加面板role=alert及真实路径回归，验证恢复桥后重试成功/错误清除；同段修正renderer props.context为冻结验证副本。修复SHA/复审待记录。

## PH-R3独立复审 CLOSED（root / GPT-6只读，2026-10-06 02:54 UTC）

修复target `e5341915ebbffd9a667f68f7d1ca9c45c14c7c52`。root核三文件diff和working实现diff empty，CUA5190 fresh Notes→Fail App bridge→Use Ocean显示局部Fixture bridge failed且主题不变；关Fail重试成功Ocean并清空alert。data-context-frozen=true。root已检查B局部context、引用键盘、菜单、主题fallback/draft、render retry/bridge失败；独立typecheck为d810。整体正式APPROVED等待M02额外只读React/接口审查，不提前声称主App已接入。

## PH-R4 — 跨任务/面板切换布局缓存丢失

P2 blocking，targete534191（d810也存在）。M02 owner独立Chrome及root CUA双复现：A打开report→B→A，report tab由1变0；PluginView task key/loading卸载真实WorkspacePanels外层缓存。作者接受，在plugins内用稳定renderer/RenderBoundary身份、显式visited+Activity、同步view授权和不匹配时空数据来保留布局且隔离数据；未修改App或既有workspace。新增StrictMode任务/面板往返、树展开/终端follow、订阅暂停恢复、无预取/无串数据、权限拒绝与disable清理。最终修复SHA及独立复审待补。

PH-R4 owner修复commit：`6ce3ba0a41d51f26cd6fbceddfbb2f80e4931bd6`；15模块/12浏览器/typecheck/生产fixture build+冒烟通过。源码/文档diff check排除原始dependency-lock.patch后通过；完整patch保留空白上下文，不能称全量diff无warning。root和M02独立复审待回，当前整体不提前APPROVED。
