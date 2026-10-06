# OPS四候选：自有证据与明确消费者（限定只读）

仅按root最终替换名单；这不是sparse/delete许可或全局无consumer证明。manager负责fresh branch/clean/sparse/ledger，Lead负责最终exact file/hash/consumer及操作窗口。没有新树、claim、项目写入或运行。

| 树 | 本轮固定HEAD | 全KEEP的唯一status / own evidence |
| --- | --- | --- |
| web-attachment-input-preview | 2b0a33e6ed00673bc66545577abce0d02148a19a | plans/wpf-attach-i01-input-preview/status.md；docs/evidence/wpf-attach-i01 |
| attachment-resources | c6989b894aa4e9103472279e697d129b28cce5ff | plans/wpf-attach01-resources/status.md；docs/evidence/wpf-attach01 |
| web-shared-ack-consumer | 8301991ad698410478bfbfa1c2443cc1bad37a27 | plans/wpf-ack01-shared-consumer/status.md；docs/evidence/wpf-ack01 |
| web-workspace-lifecycle-baseline | 12e4f3f4ca8bba8b109eb1efa03a4e50fd0fcc50 | plans/wpf-workspace-lifecycle-baseline/status.md；docs/evidence/wpf-workspace-lifecycle-baseline |

四status均声明delivered/main、metadata后全scope停写；原active行属于释放前历史，不替代manager现账本。名单替换前已只读原四树Git轻状态：input-preview为codex同名/clean，effective sparse无值，config.worktree与info/sparse-checkout均不存在；其余原名单观察到此为止。没有因此断言历史从未sparse，也不重复manager新三树准入；若manager发现已处理则直接排除。

## 已知执行闭包必须保留

- input-preview的61261审查预览由固定README/status明确保留，未探测其活性。attachment-input.browser:10输出own evidence，读取固定源hash；fixture直接消费本树官方Thread、attachments、public DTO、themes/CSS。所有源码、配置、锁、node_modules及own evidence全KEEP。
- attachment-resources固定runtime-with-fixture-candidate列16source及只读源码依赖，实际fixture位于apps/server/src/attachments/fixture.ts；默认输出own wpf-attach01，可由显式own输出目录覆盖。原PG/runtime数据、manifest、测试脚本全部KEEP，不运行其默认55432入口。
- ACK01真实HTTP测试是本树公开FlowClient/Web projection和内存server，不是可删除的evidence stub。原五实现/测试、own evidence及deps全部KEEP；不宣称当前有/无运行进程。
- lifecycle baseline的workspace-lifecycle.fixture→conversation-context-integration.fixture→conversation-stream-integration.fixture→queue/conversation fixture为实际链，必须保留整个source/test以及下游输入；原结果写own wpf-workspace-lifecycle-baseline。README说本实验own服务已清理仅属历史记录，不复采。为覆盖w01预览实现及upstream/provenance，**w01整个目录KEEP**；**chat06p01整个目录KEEP，d06所有mjs KEEP**。本轮更保守地不提出任何d06删除项。

## 当前准备包与候选复制证据

只读Recovery next8ed manifest（19source/actual000a）和DPERF04 final929b binding（7source），按显式source/dependency/runtime path与realpath核对。记录数/hash及根见audit；两包声明中没有落入以上四树或其候选复制历史证据的输入。它们的第三方真实donor是 **web-attachment-production/node_modules**（含tsx/PW/pg/Vite及pg-pool等），该目录乃至已排除production树按统一KEEP，不作为候选。CONTEXTI donor同样已排除，不继续审计。原raw/provenance仍在准备包自身/tmp、Recovery/DPERF own evidence，不能因为任务状态完成而清理。

四树的docs/evidence/d01、i01、wpf-perf01三个非own历史目录分别具有相同固定Git tree对象（audit记录）。仅可交Lead作为进一步exact-file筛选的**候选池**，本报告不主张整体移除；任何脚本/配置/运行数据入口/引用链仍KEEP，未知外部读取也KEEP。没有盘点ignored额外文件或估计物理回收，不能把Git tree相同当无消费者证据。其它历史已处理树不再列入。

未全盘/所有树扫描、未du/df/proc/lsof/preview/个人服务访问、未import/test/PG/Chrome；只git对象、明确元数据和path resolve。复用已读本地find-skills/clean-code方法。跨Lead动态目录读取不能穷尽，结论仅覆盖以上显式输入；Lead个人发布窗口期间不操作。
