# DPERF04 当前交付边界

固定 `45f8a185ad0d43543a3c9eca7a29da97ebb31ba9`，base c837b5dccaea429b0112d1c7e0c752c41334204a；[七源manifest](source-manifest.json)。原abd2产品/直接测试源码限定复审0blocking；b17/root+manager源码与populated-binding限定审已完成；[root45f8限定复审](browser-lifecycle-repair/root-45f8-source-review.json)已批准生命周期源码与准备稿，0blocking、TAIL/SOFT-STOP仅SOURCE_ADDRESSED。第二次Node7叶项+父项8/8 PASS，root已独立核原raw，累计3950ms/余26050ms。后续late-stop P2仅父准备稿已由[root544c复审](browser-late-stop-repair/root-544c-source-review.json)限定关闭，[当前delta](browser-late-stop-repair/report.md)；浏览器NOT_RUN、全片review UNKNOWN、main/真实4320未接；[唯一status](../../../plans/wpf-dperf04-summary-detail/status.md)与[独审链](../../../plans/wpf-dperf04-summary-detail/review.md)。

原4fac源码CHANGES_REQUESTED、1441首Node6通过/Host失败及1632ms完整cleanup均保留为历史；不得将后继修复或第二次通过回填旧结果。浏览器监督入口已固定，行为检查体与task-links不变；[当前监督接口](browser-lifecycle-repair/interface.md)，GO边界已真实接受，历史null已过时；新parent字节已获[root精确重绑](browser-late-stop-repair/root-544c-native-boundary-rebind.json)，19:46机会NOT_RUN已归还，本次无运行授权。

三个新只读入口 `/api/summary`、`/api/task?task=<registered ID>`、`/api/assignments`；旧snapshot与文档接口保持。声明/现场proof/领取观察分别标识与时间，详情只核指定任务+main，无完成proof跨轮缓存；未登记claim可键盘展开exactscope。

[已批准Interface](interface.md)、[源码检查入口与预算](validation-entrance.json)、[claim](claim-receipt.json)、[本人live](owner-live-claim.json)、[质量](quality.md)。运行需后置fresh准入，不运行真实registry默认browser脚本，不依赖未知PG配置。GO慢snapshot为一次观察不是本片基准。
