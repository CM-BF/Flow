# S01 固定轨迹交付策略：源码/准备交审入口

2026-10-07T14:35:56.899Z。source `bee336a01505e42bbba0e9154f8ade75eee2f244`；`delivery-replay-preparation-manifest.json` 固定18 bindings，`delivery-replay-input.json` SHA `1ab90c2b77e0d6c76aae5a7b1d80130aeb12d83fc5e40188d52ecc531ac8cd89` 固定60 inputs。**SOURCE_REVIEW_READY；pure/strict NOT_RUN，replay NOT_OPEN。** 不是当前性能结果或完整S01通过。

本段14:22:05Z–14:42:05Z仅source/offline preparation，claim508f v3/6，本人原WT。一次读取已封原O1 JSON，核43858197B/hash后提取前2048 local-measure/center样本；491756B trace/SQL1542+acquisition374+transaction132，原ordinal映射保留。没有第二次读取43MiB，没有访问KEEP；旧queue源码、input-v2与失败原件不改。

## Interface 与实际路径

- `delivery-replay.ts`：固定hash/字段/2048行界限；相同32条×64批调度；语义receiver核全部nonSQL字段/新ordinal与SQL每组key/count/elapsed，单ACK/summary/无额外消息。
- `delivery-replay-main.ts`：一个coordinator、per-query与buffered两个串行worker；同一trace，显式phase(measure)。调用原centerDelivery/childReporter，worker1失败/unknown不启worker2。每worker15s工作/至多20s关闭；父起点在fork前，close为终点。record同步、阶段含等待、finish同步、callbacks-drain、CPU分列；首消息到summary仅接收区间，不冒总成本。
- 每个实际parent控制/worker数据与ACK/summary/result均计完整JSON UTF8 bytes和单包64KiB；每arm双向合计2MiB/两arm4MiB。reporter返回true只本地接受，必须pending0/dropped0与parent精确receipt+正常close/双EOF。JSON编码bytes不是OS IPC wire/内核bytes；原startedMs/elapsedMs仅输入。
- `delivery-replay-operator.py`：固定OPS14同PID checkpoint→exec、explicit环境/固定Git与Node/Python；无admin/token/PG变量。只本实验四个有限mode，不新增OS监督循环。fresh输入/HEAD/20输出absence/floor后才spawn；已知进程终态与同inode有界inventory/阶段余量才删除新TMP，unknown或不足KEEP。输出前快照和实际print后deadline判定分开。

## 未运行的直接检查清单

只计划3个串行pure child：`types` focused noEmit；`tests` 新单文件8个语义case；`caller` 3个合成环境/关闭事实/阻塞print后deadline反例。不是11项已通过。每个work≤30s/whole≤40s，三项whole累计≤120s；每raw32KiB、总96KiB；每新TMP≤2MiB，三份累计样本上限6MiB（活动峰值/累计真实写入仍UNKNOWN），新逻辑预算候选16MiB。需经理单独确认，不消费旧普通段。

未来固定调用（不是现在的执行授权）：

```sh
/usr/bin/env -i FLOW_S01_REPLAY_OPEN=s01-observer-delivery-replay-once:types /opt/homebrew/bin/python3.13 -I -B docs/evidence/s01/mixed-ab-preparation/delivery-replay-operator.py types <CLEAN_EXECUTION_HEAD> 1ab90c2b77e0d6c76aae5a7b1d80130aeb12d83fc5e40188d52ecc531ac8cd89 <FRESH_MANAGER_FLOOR>
```

`tests`/`caller`分别同时替换OPEN后缀与首参数；`replay`是另一实际许可，绝不随types通过自动执行。四mode各唯一r1前缀，精确20输出已列input，当前全absent；消耗后不自动换suffix或重试。

## Replay 候选与必要未决项

原60s/32MiB方法不扩大：whole含预检≤5s+OPS14最多45s工作/2sTERM/3sKILL+剩余收尾；Node两侧含关闭最多40s且总体输出后同origin复核。原10s prep是上限，本caller更早HOLD。trace≤2MiB、TMP≤8MiB、raw≤128KiB、source/meta≤512KiB，实际临时JSON/RSS峰值UNKNOWN。两策略聚合/消息粒度/finish时序不同，不能称纯IPC归因或据一次顺序结果宣称原pool/取消/128容量收益。

1. 本源码/新caller独审及上面纯检查仍未完成，任何批准不得冒充实际replay READY/OPEN。
2. loader有固定tsx/esbuild源码与binary绑定，但目前只记录coordinator/两worker身份和整个owned group终态，**辅助esbuild的逐PID记录尚未实现**。设计最多三helper仅候选，不能声称实测进程数或OS cap；实际准入前必须明确解决，避免为此泛化监督框架。
3. runtime 60 bindings含所需实验闭包、TS/type-only声明、固定loader/runtime部分与包manifest/lock；并非每个Vitest传递文件/动态库独立hash。新支持供给为0，无675源码导出。
4. 历史经理floor11623661568B仅记录，future必须核完整当时sum/KEEP/个人服务与唯一reserve，再加本段实际新增预算（不得重复计）。目前Web/Original发布队列优先，0 S01 actual/NEXT。个人用户负载UNKNOWN，不能探停或假设两侧背景相等。

固定源码后由db独立审；不重跑原11/9/6/3/5、A/B或queue。旧4秒ACK跨度、取消最终态、UNKNOWN/KEEP完全保持。新增Module仅私有实验；main集成和完整S01仍未完成。
