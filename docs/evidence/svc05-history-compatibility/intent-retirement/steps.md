# 单次退役接入原发布：固定输入，未执行

实际输入在 [execution-inputs.json](execution-inputs.json)，不是许可或自动执行器。原20步只替换前置读取/比较，插入4个显式步骤；材料、refresh、resume、publish仍是原工具。每步必须上一步明确成功且其原始结果已持久化；unknown停止，不改参重试。

1. 新窗口先固化review、源和全部绑定、授权引用、新exclusive RUN与step intents。建立空hold-stop/retirement证据子目录。01/07/10实际调用 `observeLegacyIntent(frozen-input-template)`→`observeHost`；没有手工DTO转换。仅原件路径/hash/schema和四历史允许此只读采样，返回idle=false，不需要虚构未来hold编号。普通observe仍使用严格idle sampler。
2. 02/08/11用同一个 `compareLegacyRelease` 检查所有原身份/数据/审计/材料/版本规则。preflight/materials/drained只接受完全相同的旧journal。模板来源是已保存精确诊断及旧四历史，不依据不匹配现场重基准。
3. 03–06原材料导入/搬运后，09原bootstrap发drain。**09开始前** `window.run_step(..., begin_drain=True)` exclusive写一次wall/monotonic时标并fsync；写入耗时计入900秒。09及全部10–20/新增步骤都使用同一时标，剩余不足2秒不启动；每步工作上限min(118,remaining−2)，退出2秒。时钟回退、身份错误、deadline、未知均停止后继。标准supervisor只终止operator PID，不信号服务组；不以保存报告阻塞终止。
4. 11a复用当前snapshot作为单次hold前的额外全库事实；与基线DTO不混用。它要求同runner/draining16/op/全库无工作，沿原holdKey及同runner锁写hold17，保存receipt；然后原 `stopOwnedProcess` 仅停止旧runner并确认整组stopped，其他角色无信号。源码证明/后续核心双确认分别保留，不把本轮纯检查说成真实PG锁序验证。
5. 11b `requestFromReceipts` 只取新definite hold operationId与授权引用；所有原文件hash/devino/config/state/四历史从固定template带入，版本精确17，不能从不匹配现场重算。11c先durable reservation，在host lock+同runner DB锁下再次确认唯一安装/marker/全部pending/旧runner停止，再原件0600备份+file/dirsync、持久意图、固定新字节、二次确认、精确rename+dirsync、审计。未记录原ACK、不重放claim。
6. 11d只读核原件与固定新字节、private audit五文件stat/hash并持久checkpoint。仅结果retired且当前retired-bytes可继续；最后审计unknown只能保留/定位，不据字节相同自动重写。私有原件不复制公开证据正文。
7. 12原refresh源码明确允许maintenance+旧runner stopped，沿原持久op换固定af51三个角色，不虚构runner running。13/16/19恢复普通严格idle observer。14/17/20仍用显式比较器：仅journal80→46B+独立私有审计是此次允许增量，四历史/其余旧字段逐值摘要保持；原nativeIdle=false检查保存在report，不伪改raw。旧runner四维护列+新增维护audit、预声明queue_checked_at按旧口径。原15 resume一次、18独立WebCAS d629/v3。

执行前必须Lead固定原Flow checkout af51并给窗口。当前仅准备；未创建个人request/permit、未drain/stop/写journal。实际操作、PG锁/停止/新版本健康仍NOT_RUN。普通idle/旧比较规则原文不改；新增private seams只有这次已批准语义。
