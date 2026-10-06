# WPF-DPERF01 看板证明计算去重

状态：completed（branch），待integration；创建2026-10-06 05:02 UTC；更新2026-10-06 05:09 UTC；owner w01_owner / gpt-6-astra ultra（派发指定）。Worktree `/Users/citrine/Projects/AgentHarness/Flow-worktrees/dashboard-proof-performance`，branch `codex/dashboard-proof-performance`，base `698ffcd94ae073b23bcc67f6665fb19f707a93e4`。

目标：同任务、同次快照、review target等于implementation target时复用已算结果，减少重复Git子进程且保留最新检查。只改aggregate.mjs，proof.mjs只读。不加TTL/跨快照缓存/并发限流，不扩tree/main读取缓存，不改registry/human/4320或产品模型服务。

## TODO

- [x] **WPF-DPERF01-01** 用独立临时Git样本记录重复调用及行为回归红灯。
- [x] **WPF-DPERF01-02** 最小复用并验证同/异target、unknown/missing、dirty/deletion和下一snapshot新鲜。
- [x] **WPF-DPERF01-03** 直接tests与现human-proof/dashboard相关检查，固定目标独立审查/证据交付。

## 方法与边界

真实Git Trace2只对子进程env启用，输出临时绝对路径，计start/argv；不改全局Git配置，不运行真实仓库凭据命令。减少启动数是本轮主要结果，不将真实API三次波动当性能基线，不承诺壁钟比例改善。已有局部fixture用临时仓库/动态端口清理；0模型/0真实DB操作。

写入仅[receipt](../../docs/evidence/wpf-dperf01/take-receipt.json)4scope。独立[review](review.md)固定SHA；检查/审查/main集成分开。人类摘要采用能力语言，技术SHA留字段。架构/公共Interface不变，无需把实现优化画成新模块。
