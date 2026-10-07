# Lead固定任务时间合同

来源：`79da82aeb1d1943a04bc81f33bdb78fd2571af79`，`plans/AGENTS.md#task-timing`，当时文档候选已可消费，尚未main；本文件仅固定引用，不是第二规则owner。原blob SHA256 `b3af7284e0f6835650f997e73280c511d1fe26914d1c0ace12804a16cb0f0f7d`。

<a id="task-timing"></a>
## 实际任务时间与等待记录

唯一owner在status顶层字段表维护 `任务开工时间`、`任务完成时间`、`任务时间来源`。时间采用完整ISO8601 UTC `YYYY-MM-DDTHH:mm:ss.sssZ`（已有秒精度可保留）；开工是首次实际开展本task，不随每轮唤醒重置；完成是本登记task既定验收全部完成，不是某个分支、子任务或review结束。来源引用既有明确事件/receipt，分别说明开工与完成，不复制原始证据。领取receipt只证明领取，只有owner明确同刻开工才能用于恢复开始时间。

历史缺证据、字段缺失/非法或来源冲突写 `UNKNOWN`；尚未完成由owner明确写 `任务完成时间: NOT_COMPLETED`，不得把UNKNOWN当正在做。不能用更新时间、最近commit、文件mtime、claim touch或review日期猜实际开始。分支交付、独审、main集成、实际部署继续在原技术字段/证据分别记录其真实UTC及固定target，不合成一个Done时间，也不作为显示两项任务时间的前置。

dashboard只从同一可信当前snapshot的generatedAt计算**包含等待的壁钟历时**：已完成用完成减开工；明确NOT_COMPLETED用snapshot时间减开工。时间逆序/未来、缺失、frozen/stale/missing或读取失败后的旧快照不能显示仍在推进，不用浏览器now延长旧事实。显示UTC与依据/观察时点，不称CPU、agent实际工时或自动扣掉等待。新可选时间字段缺失/异常只标该项未知，不清空原已知进度、独审/集成事实或使旧task整体失效；保留原proof判断。

实际等待放同一status的 `## 等待记录` 表，列为 `ID | 开始UTC | 结束UTC | 类别 | 原因与解除条件 | 来源`；类别使用资源、接口、验证失败、审查、用户或其他，仍在等待写 `OPEN`，无证据时间写 `UNKNOWN`。真实事件发生才追加/结束，不按轮询生成记录，不从累计壁钟猜各慢因占比；重叠等待不简单相加。当前阻塞字段仍遵守ACTIVE/NONE/UNKNOWN，等待表不成为另一状态权威。

先覆盖当前活跃任务与后续新任务；历史按合法owner有证据时补，不阻产品修复或批改他人status。dashboard只读这些字段，不创建第二时间账本；本规则不改变两层任务或跨层消息预算。
