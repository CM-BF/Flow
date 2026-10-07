# WPF-I01 当前后继独立 review

状态：APPROVED（限定源码、相关局部检查与浏览器准备；首actual browser FAILED，0/4完整组；失败/ownedRETURN与scoped locator修复已独审，第二actual FAILED/2of4；公开确认前置待修）

Target: `ee9bd1179bb0e10828a1173beadcbd551c8be1bc`；Base: `3c9345df4aec85a37e8a2a155e079db260d515b1`。

唯一源码入口：[source-manifest](../../docs/evidence/wpf-i01/runtime-app/source-manifest.json)，六source。原49d71由root [source/local正式审](../../docs/evidence/wpf-i01/runtime-app/root-i01-runtime-app-source-local-review-20261007.json) 接受4新增authority direct PASS/10旧未选；affected noEmit首exit2与fixture导入修复后exit0保留，0blocking。实际局部[原件manifest](../../docs/evidence/wpf-i01/runtime-app/local-20261007/manifest.json)已独立核验，非全Web检查或mounted证明。

Caller [初审](../../docs/evidence/wpf-i01/runtime-app/root-i01-browser-preparation-review-20261007.json) 的可变metadata执行pin P2，已由[复审](../../docs/evidence/wpf-i01/runtime-app/root-i01-browser-preparation-approved-20261007.json)关闭。初审把两个metadata均简称at49d的措辞留历史：review旧pin匹配49d，status旧pin仅准备时工作树捕获。原自然plan更新同原理把其单一pin移historical，root消息明确接受；218执行输入、42外部pin与三caller没有产品/生命周期差量。[当前准备与精确manifest](../../docs/evidence/wpf-i01/runtime-app/browser-preparation.json)。

首实际执行49d71/metadata13ddb为FAILED：Files全页locator匹配两按钮，0/4完整组、0PNG。原件见[首实际manifest](../../docs/evidence/wpf-i01/runtime-app/browser-first-20261007/manifest.json)，资源完整归还，8540计费/51460未用封闭；单行scoped locator修复ee9bd已由[root集中审](../../docs/evidence/wpf-i01/runtime-app/root-i01-first-failure-locator-fix-review-20261007.json)接受。App/ConversationThread/ComposerActions归属链保证语义收窄，无first/nth；其余五source及所有四组判据未变，新actual无授权。真实BrowserWorkspace加受控Cookie HTTP不等真实中心session安全、provider、包执行或部署。要求actual outerexit与finalstdout终态、双EOF/drop0和独立exactRETURN；早期raw PASSED不足。fixture关闭与group absence不冒独立逐端口探测。原I01/MSG/runtime叶子通过仅历史。

## 原始review历史（不作当前批准）

# WPF-I01 运行时App接线独立review

状态：NOT_STARTED
Review target commit: UNKNOWN

当前后继固定base3c9345，源实施尚未固定，0新检查；不得继承原I01/MSG/runtime叶子批准。[接口与供给](../../docs/evidence/wpf-i01/runtime-app/report.md)。

## 历史首批独审（原文保留，不是当前批准）

# WPF-I01 独立审查入口

**状态：APPROVED**

Review target commit：92a786abb9f7ef16e15482ac00b98ff860ecc47f

Base：`1002f2688c2b4d2e3a5723d94bdbe965a2a88626`（完整输入 merge）；M02 metadata `c526c1c889437ee39155d669921577995195c74e`，P01 metadata `2910ebc8e11fbcb00d1c2773face229c84fe47cd` / 已批准实现 `6ce3ba0a41d51f26cd6fbceddfbb2f80e4931bd6`。作者新实现提交 253cfd11673c7f993ba7a741962ba74837b7db5c 与目标的窄屏 CSS 修正；metadata 不属于行为 target。

## 范围与验收

审查主 App 对可信 Web host 的真实挂载；精确 scope 见 [status](status.md)，方案见 [plan](plan.md)。重点：bridge 不泄露 client/token；局部 task/message/reference 身份；相同 ID 跨中心 active/hidden UI 与旧闭包隔离；真正官方 Thread ActionBar；主题 token/fallback；禁用贡献/监听/面板焦点；A→B→A/Notes roundtrip 状态保留；首屏详情 0→显式 1→cache；8 chat/双 split 观察预算。workspace.tabs 合法 panel/button/menu 均消费，动作在 tablist 外。X01 全栈、第三方隔离、持续真实模型对话、PTY/任意 fs 不在范围。

## 作者检查与进行中反馈

[验证记录](../../docs/evidence/wpf-i01/validation.md)：9 bridge + 15 direct host tests、9 HTTP fixture browser 组、3 真实隔离 PostgreSQL/public runner 旅程组、typecheck、build、production smoke 通过。明确区分真实协议与 live 模型。现有两个 >500kB chunk 告警保留。原始 lock patch 保留导致全量 diff --check 不能概括为通过，排除原始 patch 的实现/docs whitespace 检查另记。

root 在 moving tree 期间反馈 Settings 关闭焦点丢失、workspace.tabs 动作未消费；作者已修。root CUA 独立复验 Settings Close/Escape 回入口，但不以此代替本固定 target 整体 review。本次正式结论见下文，作者记录来自 root 独立报告，不以作者结果替代。

## 可复制只读审查任务

先核 tree、branch、live claim v1、base、完整 target 与 dirty。只读固定 target，不读作者 metadata dirty 代替实现。审阅上述行为并运行相应局部检查，区分 HTTP fixture 与真实中心、作者与独立证据。对每项 finding 给严重级别、触发路径、文件位置、blocking 与复验条件；修复交唯一 owner。固定target中 P01 本身没有作者改动。最终结论绑定完整 SHA，metadata 新 HEAD 不自动扩大行为 approval；原 Lead 负责 main 集成。

当前预览：http://127.0.0.1:55049/ ，HTTP fixture，owner 保持该实现冻结；不要停止用户保留的 M02 49922 服务。作者回应：已转录正式 review；实现停止写入，待范围转交。

## 正式独立结论（2026-10-06 03:30 UTC）

Reviewer：root / gpt-6-astra ultra。结论：APPROVED，严格绑定 target `92a786abb9f7ef16e15482ac00b98ff860ecc47f` / base `1002f2688c2b4d2e3a5723d94bdbe965a2a88626`。审查时 metadata HEAD4004aec721f3f7821326836092c126746f6b6a40 clean，apps 源码相对 target diff0。管理者 d01 的独立 scope/claim/docs 检查亦无 blocking。

Root 实际执行/核对：

- 只读13个实现/测试文件：资源身份、connection epoch、窄 ports、完整官方 Thread、slots组合与状态保留。
- Node24 / Vitest4 两直接模块24/24 PASS，本轮03:28:52。
- 固定同内容55049 CUA：侧栏插件打开 demo-completed；官方 Thread Task output→Terminal且焦点正确；reference→artifact聚焦与正文；Notes往返仍选artifact；Settings Escape/Close均回 Extensions and appearance。
- workspace.tabs 合法button/menu来源与局部fixture、最终390px图核对，动作在tablist外。

| 发现 | 触发 | 修复与结果 | 状态 |
| --- | --- | --- | --- |
| Settings return focus | Close/Escape后焦点曾到BODY | controlled Dialog onCloseAutoFocus恢复实际入口；root两路CUA复验 | CLOSED |
| workspace.tabs actions | 合法button/menu曾被panel过滤静默丢弃 | 同workspace context独立AppSlot，动作不置于tablist；合法声明fixture/键盘/Bcontext/disable通过，root复核 | CLOSED |

未重新运行作者9browser/3PG/build全套；root已读原始报告与最终源码不变复用边界。结论不覆盖live模型/持续chat、完整X01插件管理、PTY/任意fs或main已集成。后续只有metadata，不扩大行为approval。

## 第二实际 ee9bd / d779

[root3bfd实际审](../../docs/evidence/wpf-i01/runtime-app/root-i01-second-failure-return-review-20261007.json)接收FAILED+FULLRETURN；[16原件](../../docs/evidence/wpf-i01/runtime-app/browser-second-20261007/manifest.json)保原。仅前两完整组通过，第三protected connection前置未完成，第四未到、0PNG。静态链显示测试遗漏附件离开确认，未存失败DOM不冒直接观察。源修待单独固定；无第三browser批准。
