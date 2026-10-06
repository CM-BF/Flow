# S01 容量证据差距

2026-10-06 06:20 UTC读取4320权威源；均clean。未启动测试/压测/模型。现main已由Lead提供完整受审基线 `115b0dbdfa02db5483f9e9699852682ce699633c`，S01仅新合同。

| 任务与固定实现 | 权威worktree / 观察HEAD | 已证实 | 尚未证实 |
| --- | --- | --- | --- |
| B01 `70af7b45814d5ed31d9638649512358e1a0a834b` | bounded-read-performance / `a2b56ac2085b8943b38cc78ee1cd59c0242f9e2c` | 真实HTTP/PG，1/16/128合成已存任务、有界读取、投影无丢重与局部修复 | 这些数量不是在途执行并发；没有runner负载容量 |
| LAB01 `f226c42dba577053f64a14dcf213180bf150f66d` | performance-probes / `40b115c25b42ee6e88c8516e2a27a3a1b158541a` | 128模拟DOM状态、8192逻辑事件与懒详情toy | 无产品执行、PG、模型；不是执行容量 |
| LAB02 run `2fad2bc5cb6d1f720631fd56e557f193c44ebf7f`，review `e202e4ff27c776a662676bfbe333aeb99d811039` | observer-probes / `56281848ed07a3f5ab72e58fc81b4e83ba6b9ab4` | 1/16/128观察连接，静态64事件追齐、真实HTTP heartbeat | protocol-only runner无adapter；没有持续多任务执行、pool等待或恢复压测 |
| R03 `9c59740fd45575c7ca5cccbdfdbd5772e5cf1d2a` | runner-reliability / `b4e5bbd56232b0a16339ee1f49fe1e53ae437ae3` | 保守租期、晚包/时钟偏差、本地存储失败退出，54项局部检查 | 没改并发/outbox规模；BR-01/S01明确开放 |

以上worktree共同前缀 `/Users/citrine/Projects/AgentHarness/Flow-worktrees/`。原报告见 [B01](../b01/README.md)、[LAB01](../lab01/README.md)、[LAB02](../lab02/README.md)、[R03](../r03/report.md)；报告中的历史main/待审文字不能覆盖当前owner status的事实。

## 代码观察与最小假设

现有 `apps/runner/src/runtime.ts:runRunner` 在主循环内await execute，结束后才睡眠并再次claim；`packages/contracts/src/runner.ts` capacity允许1..16，`apps/server/src/runners.ts:claim` 用runner行锁和未完成attempt计数拒超领。故注册capacity=4并不能证明单runtime同时执行4个；本实验用真实进程/attempt区间验证这个区分，不先改产品。

中心 pool max8，scheduler pool max3；数值只是配置上限。scheduler wake批次1/0.5s且中心有补偿扫描；需要分别测受理→dispatch/claim等待，不能把总延迟归因于adapter。未做等待/吞吐实测，不宣称此处就是已证实瓶颈。

最小缺口是有执行时的计数、延迟和可靠性：128持久空会话背景+16任务、4真实runner进程，每个slot=1；有限对照与故障按合同独立进行。128个会话为空历史明确标出，原生session另计，不声称原生长会话容量。

## 技能发现与实际方法

读取本地 `/Users/citrine/.agents/skills/find-skills/SKILL.md`，优先应用已有 `codebase-design`、`clean-code` 与 `webapp-testing`。clean-code固定来源 `sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5`，不重新安装。brainstorming按有界研究处理，Goal Owner已批准短方案，无新增审批门槛。

未发现专门的本地runner容量测量技能；先访问 [skills.sh](https://skills.sh/)，再在独立npm缓存执行 `npx --yes skills find 'load testing'`。实际读取候选 [Cloudflare web-perf](https://skills.sh/cloudflare/skills/web-perf)：内容为浏览器Core Web Vitals/网络/布局审查，不适合本次后端执行容量，未安装、不用排名代替方法。

采用明确工程方法：固定工作量和硬截止、正常/故障分样本、真实公共HTTP和runtime、独有DB/动态端口、每事件身份核对、完整原始分位数、源码摘要与独立方法review。codebase-design用于限制实验为编排/计量/runner子进程职责，不设计通用压测平台。webapp-testing只用于本人浏览器生命周期证据，使用显式running/ready信号，流式接口不等待networkidle。尚未启动其工具或浏览器。

06:25 UTC clean-code安全停点：明确实际/声明计数，清理路径先定义，消除将128空会话称native会话的歧义；不制造生产执行pool。当前未解决项为实验未实现、未取正式窗口、方法待独审，不是产品性能通过。
