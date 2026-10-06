# 固定 context core probe

本实验使用 [acp-kernel](https://github.com/ranxianglei/acp-kernel) **npm0.0.101**，未修改公开core bundle。实际LICENSE在MIT正文后有产品表面/文档署名要求，完整原文保存在vendor/acp-kernel-0.0.101/LICENSE；不把package的MIT标签当全部条款。来源与每文件hash见[provenance](../../docs/evidence/ctx01/provenance.json)。GitHub0.0.104、Pi0.1.83、proxy0.1.185都未被本实验运行。

无需安装，使用Node24：

```sh
node --test experiments/context-kernel/host.test.mjs
node experiments/context-kernel/run.mjs /tmp/ctx01-new-results.json
```

输出必须是新文件，避免覆盖原始结果。仅读取同目录已固定bundle，实验子进程只带PATH/LANG；无provider/登录/模型/生命周期脚本。上游index还导出可读目录的pack helper，本实验不调用它们、不引persist/wire/panel、不使用可选BPE tokenizer；显式UTF8字节/4 estimator不代表provider token。准备阶段只从官方npm读取版本元数据和tarball，没有执行下载包脚本。完整tarball按SHA512验证后，仅复制core运行所需三个JS、原package.json和LICENSE；不是安装完整插件。

公开core调用链：processTurn赋ref→applyCompression固定手写summary→storeCoveredOriginals保存覆盖原文→processTurn得到可见投影→retrieveByRef校验每个ref的UTF8字节/hash。未知ref保留not-found。六条合成消息含中文/emoji，首请求相同、各session局部raw IDs相同而内容独立。四条助手材料被压缩，首/末用户消息保留。

host职责明确：JSON封套绑定schemaVersion/kernelVersion/sessionId/revision，state和contentStore共同持久化，并保留原raw历史。重新启动是退出prepare子进程后，由另一个真实OS进程读checkpoint、核原文hash并重新执行core投影；非真实模型session恢复。fork使用宿主structuredClone/新ID/parent lineage，并修改child块/store核parent不变。版本门禁仅拒指定不匹配版本/身份，不是完整不可信JSON验证器、PG CAS或并发控制；不声称core原生支持fork持久宿主。

每规模1/10/100有20次有效重复，顺序运行N个内存session而非N个并行agents。每步样本是整批N session的时间，nearest-rank p50/p95（N=20，p95为第19有序样本）。CPU来自process.cpuUsage，RSS有前后采样与每个worker进程maxRSS；本机共享主机/短样本包含冷启动、JIT、GC、OS噪声，不作SLO或容量结论。每child10秒、loop开始前总180秒门限；失败记录并结束、不自动重试。测量checkpoint只在自己临时目录，finally清理，不触及PG/产品服务。

固定手写summary不测语义完整性/模型服从/信息损失；保留原文不证明摘要够用。可见字节缩小不等于存储或账单节省，checkpoint保留raw历史+store可能变大。未知source更新/损坏store迁移、跨机、生产权限/唯一compression owner协商、真实多agent与模型成本均未测。
