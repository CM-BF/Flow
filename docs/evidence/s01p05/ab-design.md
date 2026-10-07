# S01后继A/B输入与预算候选（无窗口OPEN）

这是原S01 TODO的准备设计，不是新benchmark/调度器，也不许可实际预演。GO方向：两固定版本各128任务/attempt，总256；同8×16、0 provider，总300秒含完整自动证据/cleanup/CLI、512MiB。只有P05实现和两版输入/profile预算独审后，由Mika点名唯一window与clean execution HEAD才可运行；须与发布和Nodeactual串行，不要求无关团队停工。

## 可比输入

A为固定main aeb764e5上的原persistEventState三task UPDATE；B为同基线加已审P05单UPDATE。两个实际生产输入逐字比较，允许runtime差异只能是events.ts的该已审差异；测试/docs/metadata不作运行差异。固定Node24、PG16、依赖、pool max8、schema/migrations、runner/fixture/client和所有其他生产输入均相同。

两边必须使用同一个共同实验source target，包括已审c259 observer修复，不能A用旧classifier/B用新classifier。其余profile/输出计量/错误分类/采样/内存/cleanup路径相同；使用已存在mixed driver/profile/ownedprocess能力作最小身份和总预算适配，不复制两套driver。独立A/B输出及专库/state，旧128 run目录/manifest/journal不参与。

候选同节奏：每侧8个runRunner×16，同一个runner子进程；6秒固定观察、每attempt 2Hz×256B awaited emit、1s heartbeat、500ms poll、3s请求、10s lease、200ms DB单飞观察、100ms轻读最多2并发、1s内存观察、最多5s settlement。所有这些字段需成为相同profile的固定hash；两侧均128 unique session/task/attempt，不能因unknown补投或把barrier128当持续行为。每侧记录真实峰值、窗口ACK跨度与30类采样证明同等门禁，不预设样本数量一定30。

## 一个总clock及预算责任

建议仅加一层薄的固定A→B编排，复用既有runMixed/ownedprocess与profile；不引入通用测量框架。一个外层单调clock从任何preflight/hash/reservation前开始，到两侧全部close/证据/CLI完成停止，并另保留process-exec/import-through-exit wall。内层两个driver计时是诊断，不能分别各给300秒或拿内部elapsed冒充总时长。

候选可审时间分配：共同预核最多15s；A最多135s（工作105s+清理最多30s），A成功且资源确认闭合后立即进入B，不人工等待取好数据；B最多135s（同配置），最后统一CLI/证据余15s，总上界300s。每阶段deadline取其固定阶段上限与总deadline较早者。B开始前若没有完整135s+15s剩余、A任一未知/失败/资源保留或计数无法证明，B=NOT_RUN，不缩短窗口或改参数。两侧清理子阶段需从同一135s profile导出并在固定source审查，不能沿旧180s硬编码复制；强停不能视为已取消OS工作，未证明close/0连接时保留DB而不DROP。

候选字节分配：外层总512MiB，384MiB软停新增、128MiB收束；每侧同240MiB硬上限/192MiB软停，另32MiB用于共同输入/编排/最终档案的保守reserve（2×240+32=512）。外层唯一账本预扣固定输入和收据reserve，归集两侧可归属Node流/IPC/可见证据计量；一处物理写按既有保守重复口径记录，说明重复而不遗漏。两侧是否需要更紧观测record cap/档案reserve只由固定source估算决定，不能实跑试参数。任何计数seam未知则不能PASS。

这组分配尚未实现/独审，不承诺300s内一定清理成功。自动总clock和remaining-budget传递是后继fixed driver审查重点；没这个接线就不运行。文件归档和CLI尾部必须预算内，人工Git/review时钟外但产生证据字节仍计。

## 结果口径

A→B固定顺序会混入warm-up/缓存/后台负载、IPC及observer本身开销。报告两侧源hash、进程数和runtime数、pool acquisition（含连接建立）、transaction elapsed、精确share/exclusive query elapsed与Lock正样本；不做HTTP相减，不将未采到Lock当0等待，不从单次A/B宣称纯锁因果/严格speedup/SLO。内存每进程独立采样峰值，不能相加称同时峰值。

每侧全库独立128task/attempt/session计数、256总上限、event id/seq/digest/fence/ACK、窗口内heartbeat与保守DB query间隔、unknown占用/journal和专库清理均必须完整。错误按发送/ACK/stop时间、HTTP status/允许错误类及task/attempt身份分组，哪怕整体PASS也保留。A失败就不跑B，B失败保留A事实，不补数不重跑；总合同结果按失败或unknown如实记录。128fixture执行不等于128native SDK/模型/token容量。
