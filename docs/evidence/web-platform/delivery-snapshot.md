# 已审 Web 交付快照

记录时间：2026-10-06 03:20 UTC。此文件是提交级交接索引，不是第二套手填进度；当前事实仍读取各唯一status。管理者只读核验以下owner树HEAD/clean与路径，未重跑全部owner测试。原Lead负责main/共享依赖集成，我方不merge main。

| 交付 | 实现 target / 独立review | metadata HEAD / branch / dirty |
| --- | --- | --- |
| W01 官方完整Thread、紧凑shell、split/merge与panels | `cb4a39211e264538704ba9d474eeb08fc4b2759c` / root APPROVED；SSE后发现由M02 d47修复并独立关闭 | `d2631f03b4bdc9bc0d543f09c11c8961a1fdf557` / codex/m1-web / clean |
| WPF-M02 连续工作记录/决策/按需下钻与观察预算 | `d47c602f3bab1fe97a9be70fd37780c2918bcfbc` / root APPROVED | `c526c1c889437ee39155d669921577995195c74e` / codex/web-unified-workspace / clean |
| WPF-P01 可信Web插件host、真实builtins与sample | `6ce3ba0a41d51f26cd6fbceddfbb2f80e4931bd6` / root整体APPROVED，PH-R1～4 CLOSED | `2910ebc8e11fbcb00d1c2773face229c84fe47cd` / codex/web-plugin-host / clean |

03:17本地main与origin/main均为 `3773db5d014a6d38d09553acd0a5fe8df900b7c4`；管理者实际ancestor核包含W01 cb4与M02 d47，P01 6ce不包含。此为本地引用观察，不声称此后远端永远未变；metadata不是自动扩展approval。I01正在独立挂载P01，PERF正在固定M02测量，二者尚未在此表冒充完成。

## 可查看与恢复

用户主预览：[已审M02 HTTP fixture](http://127.0.0.1:49922/)，原Goal Owner已打开并保留用户tab。服务owner workspace_panels_owner、exec session17885；恢复在web-unified-workspace：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/workspace-preview.ts --preview
```

该命令恢复使用动态loopback端口，以stdout为准，不保证再次49922；仅管理自己进程。不是模型服务或生产中心，未启动另一套main3773服务。

P01 [隔离host fixture](http://127.0.0.1:5190/src/plugins/fixture/index.html)在web-plugin-host，恢复命令先确认5190仍由自己的服务占用或空闲，不杀其他进程：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm --dir apps/web exec vite --host 127.0.0.1 --port 5190 --strictPort
```

[I01开发fixture](http://127.0.0.1:55049/)仍由其owner保留，moving tree不是本快照的固定已审交付。

## 检查与实际边界

- W01：作者10 HTTP / 4 client-contracts / 10 browser / 最后3导航专项 / typecheck / build通过。root独立10 HTTP+typecheck、官方源hash和实际完整Thread diff、CUA新任务/决定及侧栏同步；读作者其余报告，没有声称独立重跑全部浏览器。官方Thread registry原文hash `64cb85b4076644dd319325b319264ec8e998e619a97c19e0f001d3fa5a03a016`。
- M02：作者20局部测试/typecheck/build、9总览浏览器、6观察预算浏览器、4真实PG/HTTP组通过；真实10任务由公共runner协议驱动，不是10模型。root独立20/typecheck、8保留chat/决定/详情/split/merge/390px活动tab与darkoverview，通过后关闭HTTP1 SSE饥饿P2；未独立再跑PG。管理者逐文件scope核查通过，共享manifest/lock/contracts未改。完整diffcheck因原始patch和捕获文本保留空白而退出2，排除这两原始证据后的source/docs检查0，不能说完整diffcheck0。
- P01：作者15模块/12浏览器/typecheck/生产fixture build+静态冒烟通过；root与原finding reviewer独立15模块及实际A/B/A、Notes、错误/deny/disable。模块/React/fixture审批不覆盖主App集成、公共中心安装管理、PTY/fs或第三方隔离。

每项完整命令、双主题与窄屏图、实际技能发现/来源、clean-code发现与修复、未验证事项、plan/status/review入口如下。W01/M02未保证reload后布局草稿、split remount滚动恢复；P01仅可信同realm Web host。BR-01真实PTY/fs、X01持久npm全生命周期/权限/CLI/第三方隔离继续开放。旧JS gzip323056B只是基线，不代表性能达标。

## W01入口

工作树：`/Users/citrine/Projects/AgentHarness/Flow-worktrees/m1-web`。

[plan](/Users/citrine/Projects/AgentHarness/Flow-worktrees/m1-web/plans/w01-web/plan.md) · [status](/Users/citrine/Projects/AgentHarness/Flow-worktrees/m1-web/plans/w01-web/status.md) · [review](/Users/citrine/Projects/AgentHarness/Flow-worktrees/m1-web/plans/w01-web/review.md)

[检查与限制](/Users/citrine/Projects/AgentHarness/Flow-worktrees/m1-web/docs/evidence/w01/thread-revision/validation.md) · [技能与clean-code](/Users/citrine/Projects/AgentHarness/Flow-worktrees/m1-web/docs/evidence/w01/skills-and-quality.md) · [浅色截图](/Users/citrine/Projects/AgentHarness/Flow-worktrees/m1-web/docs/evidence/w01/thread-revision/light-split.png) · [深色截图](/Users/citrine/Projects/AgentHarness/Flow-worktrees/m1-web/docs/evidence/w01/thread-revision/dark-split.png)

## WPF-M02入口

工作树：`/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-unified-workspace`。

[plan](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-unified-workspace/plans/wpf-m02-web-workspace/plan.md) · [status](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-unified-workspace/plans/wpf-m02-web-workspace/status.md) · [review](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-unified-workspace/plans/wpf-m02-web-workspace/review.md)

[检查与限制](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-unified-workspace/docs/evidence/wpf-m02/validation.md) · [技能与clean-code](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-unified-workspace/docs/evidence/wpf-m02/quality.md) · [浅色截图](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-unified-workspace/docs/evidence/wpf-m02/workspace-light.png) · [深色截图](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-unified-workspace/docs/evidence/wpf-m02/workspace-dark.png)

## WPF-P01入口

工作树：`/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-host`。

[plan](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-host/plans/wpf-p01-plugin-host/plan.md) · [status](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-host/plans/wpf-p01-plugin-host/status.md) · [review](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-host/plans/wpf-p01-plugin-host/review.md)

[检查与限制](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-host/docs/evidence/wpf-p01/validation.md) · [技能与clean-code](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-host/docs/evidence/wpf-p01/quality.md) · [浅色截图](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-host/docs/evidence/wpf-p01/host-light.png) · [深色截图](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-host/docs/evidence/wpf-p01/host-dark.png)


## 03:32 增补：I01实际App插件接入已审

实现 `92a786abb9f7ef16e15482ac00b98ff860ecc47f` / base `1002f2688c2b4d2e3a5723d94bdbe965a2a88626`，最终metadata `b5844442699733558a152c12392ea78f26c393a4`，branch codex/web-plugin-integration、交付时clean。root整体APPROVED；独立24模块与55049实际Thread→Terminal/reference/Notes/Settings焦点；作者9浏览器+3真实PG/publicrunner+生产检查边界见[validation](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-integration/docs/evidence/wpf-i01/validation.md)。没有实际模型或完整持久插件管理。

[plan](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-integration/plans/wpf-i01-plugin-integration/plan.md) · [status](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-integration/plans/wpf-i01-plugin-integration/status.md) · [review](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-integration/plans/wpf-i01-plugin-integration/review.md) · [技能/clean-code](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-integration/docs/evidence/wpf-i01/quality.md) · [浅色](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-integration/docs/evidence/wpf-i01/integration-light.png) · [深色](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-integration/docs/evidence/wpf-i01/integration-dark.png)。root报告主线已无冲突集入integration0d1a33c且source同，type/build进行中；该时点不能说main已集成。原owner停止实现，03:35四接缝已正式转CHAT claim，其余I01 scope保留回修责任。


## 03:50 增补：PERF02有界Activity窗口已审

实现 `a87f64f48a3b7e8d03429ab0673c210076a2df0d` / base `cc33403cd9b357fcd85484b7bc6952dc1220d689`，固定报告 `d891195688d849e7623cd2805b3f64cfd07b959d`，最终metadata `172d10d63179a4861cc0fbf986dec10bd0a45f10`；branch `codex/web-activity-window`，tree `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-activity-window`，实际交付clean、target至HEAD apps/web差异0。root独立APPROVED，03:49实际dashboard checks/review同a87、proof unchanged、issues空、main not-contained；已交原Lead集成。

作者13局部/直接依赖tests、typecheck、8普通production浏览器、smoke及1/16/128各一次正式生产矩阵通过。root独立13tests、全源码/probe/测试diff、390浅深目视、重新独立生成每场10040条id/cursor/body SHA与raw统计；未独立重跑typecheck/build/browser/矩阵。管理者scope/shared零diff、metadata7md39links与TODO一致通过。每场全部记录可遍历、最大挂载16行，末DOM200/802/1077。只约束DOM；projection/height/prefix仍线性，单样本共享机/threshold观测/无GC/CDP内存与wallclock限制明确，不称模型容量/完整性能已解决。Safari/Firefox/屏读/真实中心/I01/CHAT组合未验。

[plan](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-activity-window/plans/wpf-perf02-activity-window/plan.md) · [status](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-activity-window/plans/wpf-perf02-activity-window/status.md) · [review](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-activity-window/plans/wpf-perf02-activity-window/review.md) · [结果/限制](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-activity-window/docs/evidence/wpf-perf02/results.md) · [技能/clean-code](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-activity-window/docs/evidence/wpf-perf02/quality.md) · [浅色390](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-activity-window/docs/evidence/wpf-perf02/window-light-narrow.png) · [深色390](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-activity-window/docs/evidence/wpf-perf02/window-dark-narrow.png)。

没有常驻本地URL；本批浏览器脚本用动态端口并finally清理，不替换用户49922。复现使用该tree既有依赖、Node24/pnpm9.15.4：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/workspace-window.browser.ts
```

基准另用 `pnpm exec tsx apps/web/test/performance-probe.ts --smoke` 或默认完整矩阵，必须协调同机测量窗口、写新证据，不覆盖旧raw。owner已停止主动生产写入、保留claim待回修/受控交接，未自动集成main。

04:02 PERF02 main后续已确认：主Lead完成8f1481df880cf5077e1ddb9a8f302fe700a7ece8 main/origin push，root实际ancestor核与管理[04:01:56 dashboard](perf02-main-dashboard.json)一致，targeta87已包含且scopeEqual/current真。上方03:50交付时not-contained是历史事实，当前集成已闭合；没有新增本队产品实现或重复测量。


## 04:12 CHAT首持续会话交付

实现 `7cbabb737f26b108275e80f1b6cd0425699f3c18` / 完整base `b5844442699733558a152c12392ea78f26c393a4`，最终metadata `3319122ea2d225e96f587a86a0f5ff97a3191b0b`，branch `codex/web-conversations`，tree `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversations`，clean。原842被REQUEST_CHANGES的CHAT-R1旧ACK降级新事实、CHAT-R2多轮漏页均在7cb修复并独立关闭；root限定整体APPROVED。04:10真实dashboard checks/review同7cb/proof unchanged/issues空/main not-contained，见[快照](chat-approved-dashboard.json)。

作者33直接测试、开发11浏览器、生产11浏览器通过；最后composer/配置标签小适配后只局部production1+typecheck/build，随后修复25相关测试/typecheck。w01独立16projection测试和3公开接口探针；root读完整App/官方Thread/bridge及截图，实页会话/草稿/焦点/打开任务面板，未声称独立证明两个turn相同fixture输出的task身份。管理者逐commit scope/shared哈希核查、最终7Markdown39links/7TODO/diff0通过。保留原始transport.patch空白例外，不写完整diffcheck无条件通过。

[plan](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversations/plans/wpf-chat01-conversations/plan.md) · [status](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversations/plans/wpf-chat01-conversations/status.md) · [review](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversations/plans/wpf-chat01-conversations/review.md) · [验证](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversations/docs/evidence/wpf-chat01/validation.md) · [技能/clean-code](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversations/docs/evidence/wpf-chat01/quality.md) · [浅色](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversations/docs/evidence/wpf-chat01/conversation-light.png) · [深色](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversations/docs/evidence/wpf-chat01/conversation-dark.png)。

[保留预览](http://127.0.0.1:63743/)是HTTP fixture/session14932，没有模型。恢复在本tree执行 `PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/conversation.fixture.ts --preview`，动态端口以stdout为准。49922/55049保持。真实中心/两次模型由主Lead固定集成后验收；本队0模型。queue/steer/voice/files/每turn模型控制等cap=false明确unsupported，首批交付不关闭后继要求。outbox/草稿为连接内内存，reload会丢本地unknown记录/草稿；中心已受理会话持久。
