当前固定 `abd2aff768f97350762b2eaddbe7ae6843902f48`：首轮Host用例失败后仅修请求构造并新增服务端入站Host断言；源码待审/未复验。原1441六子项通过、Host失败与完整cleanup如实保留，运行总额已用1632ms，余28368ms。

# DPERF04 源码候选

当前修复target `1441d86baa40e98f4cb81b82dcc551202973209b`，base `c837b5dccaea429b0112d1c7e0c752c41334204a`；七实现/测试源见[manifest](source-manifest.json)。当前仅源码完成，Node首轮 **FAILED**（6子项通过、Host断言200≠403；含父项TAP6/2），browser **NOT_RUN**，原4fac独审 **CHANGES_REQUESTED**，当前修复待复审，main/真实4320未接。唯一事实源[status](../../../plans/wpf-dperf04-summary-detail/status.md)。

三个新只读入口 `/api/summary`、`/api/task?task=<registered ID>`、`/api/assignments`；旧snapshot与文档接口保持。声明/现场proof/领取观察分别标识与时间，详情只核指定任务+main，无完成proof跨轮缓存；未登记claim可键盘展开exactscope。

[已批准Interface](interface.md)、[源码检查入口与预算](validation-entrance.json)、[claim](claim-receipt.json)、[本人live](owner-live-claim.json)、[质量](quality.md)。运行需后置fresh准入，不运行真实registry默认browser脚本，不依赖未知PG配置。GO慢snapshot为一次观察不是本片基准。
