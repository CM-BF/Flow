# 单目标加载观察结果

窗口已消费。1个目标SIGABRT，完整stdout0B/stderr261B；受控分类`library-not-loaded`，errno未知，精确公开角色runtime-44。CLI/tool0仅表示完整观察，不能声称Node启动/隔离成功或旧失败原因。目标输入权限未改，0编译/SDK/provider/监听/重试。

外部pre-call13:39:53→tool-finish13:39:56 UTC，秒粒度保守上界4s；内部167.188ms是result持久化后、CLI前，非全部退出时间。outer-final仍为尾部采样；tool回执覆盖实际shell退出。driver确认双流EOF/close/groupGone、清理与完整计量，returned私有文件及可确定allow根均查不存在；denied根精确路径未返回，只依driver收据，不扫描补证。

batch pre-persist快照receipts296不含其自身2617B；持久化后receipts2913，CLI另2727。observed261与private disk7041分计（disk含raw261复制）；copied261是前者子集，不再次相加。runtime prepared79890+observed261+disk7041+receipts2913=90105；加CLI2727及outer639=93471。outer639=捕获207+磁盘207+三UTC/exit/bytes收据225；自动安全收据也在后续archive全文计量，保守重复保留。人工Git/review时间在运行外、bytes计archive，最终全量见archive-result.json。

本次源/旧raw冻结，当前没有后继授权。结果待独立忠实性review；公开role来自固定字典，不推断具体拒绝规则。
