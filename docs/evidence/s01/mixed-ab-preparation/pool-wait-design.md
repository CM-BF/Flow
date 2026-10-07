# S01：连接等待与聊天响应的下一测量设计

设计段实际开始：2026-10-07T12:16:51Z；owner status_read / gpt-6-astra，co-lead mika，沿 FLOW-001 的 S01-04/05/06。**DESIGN_READY / IMPLEMENTATION_NOT_STARTED / NOT_OPEN**。本页是原任务方法设计，不是新实验授权；旧 A/B source、raw、结果与接收记录冻结。

## 现有证据及不能推出的结论

固定结果914cb63824f614223b62153c770186e9d46d586e的两份 `mixed-ab-run/{A,B}/observations.json` 已只读重算。筛选 `poolRole=center`、指定kind、接收侧phase=`eight-by-sixteen:window`；nearest-rank使用排序后 `ceil(n*q)-1`。这是GO指出的分组，不冒充先前报告的严格runner窗口。

| 侧 / kind | n | p50 ms | p95 ms | acquisition waitingMax / totalMax |
| --- | ---: | ---: | ---: | --- |
| A / pool-acquisition | 4699 | 9.209 | 60.407 | 121 / 8 |
| A / transaction | 2376 | 4.935 | 7.603 | — |
| B / pool-acquisition | 4696 | 12.589 | 72.688 | 123 / 8 |
| B / transaction | 2374 | 5.040 | 11.739 | — |

全记录数A78998、B74291；原件SHA256分别 `5fd89b0ac8867d3e738b69d7941c7e17720885a6ad6691cd60b0f7675edb780a`、`49d88c2df64966b5b26a07291f3bb406da4b67dbaeecf6da59777d2cb28c5aa4`。本段只读解析内存，没有运行原analyze项目脚本或写回原件。

- `observe-pg.ts:27–35,54–60` 的 acquisition 是调用connect到settle，可能含建连；计数在settle读取，并非arrival队列、等待积分或完整峰值。官方 [Pool API](https://node-postgres.com/apis/pool) 说明所有client占用时请求会排队；它不把整个acquisition时长定义成纯排队时间。
- `:42–50` 的 transaction 从BEGIN调用到COMMIT/ROLLBACK settle，不含acquire→BEGIN、commit→release；两类样本不配对。不能以p95相减得到“排队占比”，也不能把短transaction推断为锁/SQL成本已排除。
- `channel.ts:3–17` 每条query观测都会JSON.stringify计字节并process.send；driver再记录IPC接收phase/归档。中心事件循环、序列化和IPC处理可能扰动被测请求，当前未测净开销。`poolRole=center`只是max8+statement_timeout10000启发式，不是明确注入身份。
- 接收侧phase不是中心/runner共同6秒；跨进程performance.now不能直接相减。waitingMax121/123支持“观察到大量排队”，不证明具体HTTP慢请求在等哪个checkout，也不证明根因是池太小。
- 原A/B只有events.ts生产差异且固定顺序；SQL总数下降与延迟无一致收益的结论保留，不改写成提速。

## 推荐最小实验：先隔离观察传输，暂不做全因子矩阵

固定生产baseline **main4fdd856293a502209d7509ea37da901bbfd89f72**（本段只读观察时clean），两侧完全相同。保持server max8/statement_timeout10000、scheduler max3、现有锁/事务/持久化/claim协议；不增pool、不改SQL、不做生产错峰。旧历史A/B的A3e670/Baae1不可用于本次生产对照，原ab合同与输出namespace不复用。

| 单次顺序 | 唯一变化 | 可以回答 / 不能回答 |
| --- | --- | --- |
| O1 | 现有逐query IPC发送；保留现有connect/transaction计时，epoch字段与O2一致 | 当前详细观察方式下的用户请求和checkout分布 |
| O2 | SQL分类计数与耗时在中心有界累积，仅在测量结束/停止时有界分块输出；必要生命周期与ACK证据仍保留 | O1→O2仅比较遥测交付方式的敏感性；不是无观察器基线，不证明全部观察开销或生产收益 |

两个cell均8个runtime实例×capacity16，同一runner child承载（不是8个OS进程），128个fixture task/attempt/session共同进入活动屏障；500ms周期、256B正文、1000ms heartbeat等沿现已测负载。两侧相同同步开始，不同时加入错峰变量。首片只保留已有emit/ACK与活动屏障证据，不增加全面相位偏差或checkout→release拦截。同步突发仍是控制不变的已知负载形状，首对照不尝试证明其因果。

若O2仍有高获取等待，后继再决定是否需要**checkout→release配对/hold测量**或**同O2观察方式的确定性分散发送对照**；前者才能补全持有时间、后者才干预突发，分别另定最小输入和预算。本设计不自动启动第三组。若O1/O2样本不完整或任何正确性/清理未知，停止后继并保留失败；不换顺序重试以追求更好数字。一次O1→O2仍受顺序、缓存和共享PG背景混杂，报告只给方向性诊断，不给置信提升或SLO结论。

## 用户结果与计量 Interface

复用现有 `runMixed`、私有 `observePg`、childReporter、deadline/budget及owned cleanup；加一个有限recipe和observer交付策略，不新建middleware/追踪平台/第二scheduler。删除该策略会重新出现逐query IPC的成本选择，因而是有实际消费者的单一seam。

| 所有者 | 最小输入/输出与不变量 |
| --- | --- |
| 中心私有observer | `delivery: per-query | buffered`、固定epoch、预算接收器；沿同一Pool/client wrapper，保现connect调用→settle及BEGIN→terminal计时、settle计数与结果分类，不加checkoutId或release拦截。仍不是纯queue/完整hold，样本不配对；不记录SQL参数/凭据。 |
| 中心有界累积 | acquisition/transaction各最多16384个有限数值样本；SQL仅既有有限category计数/总耗时，不存每query文本。计数/容量溢出明确invalid并停止新增工作，保留清理通道，不丢样后声称精确quantile。中心累积逻辑数据≤4MiB，结束分块每块≤64KiB、全输出计入IPC/raw预算；正常stop和失败都flush一次，不无限重试。 |
| driver请求观察 | 沿现唯一HTTP调用记录request ordinal、路径类别、发送/接收/解码时刻、字节和状态；不跨进程相减。HTTP与acquisition/transaction均没有对应关系，明确UNPAIRED；首片不相减quantile，不归因单条HTTP。 |
| 阶段/时钟 | driver发epoch并等center/runner各自ACK后开始负载；各进程用自己的单调开始/结束标记筛选。记录ACK往返与本地窗口、跨边界在途数；IPC接收phase只作路由。报告“同epoch本地窗口”，未经时钟校准不称严格共同6秒；外部tool/time/入口单调计时分列。 |
| 错误和取消 | 保持原promise、callback、this、错误对象；不改release(discard)或SVC07 client error listener。wrapper恢复在finally。abort只终止新请求/排空已有请求，不清除未知ACK、不变更持久化payload。观察器报错不改变SQL返回，实验判无效并保留证据。 |

已锁定真实安装依赖：pg **8.23.1**（package.json SHA `b1e53333a3d0c2c47c49a5cb919d221135dc03145df740925b899bc2baacc435`）、pg-pool **3.14.0**（SHA `0a9924def9e06f791b09a44eaefb227f323a39199887f6ce17b44cb5a9193134`）。只读现有安装，不将在线文档新增API视为本版本能力；实现前按其真实callback/release签名定向验证。Node24/pnpm9.15.4/Vitest4.0.18沿工程基线，实际入口需在准备时绑定，不安装更新。

### 聊天轻读与取消

每侧先通过公开conversation创建/turn/runner claim+events建立**一个已完成、正文固定1KiB的合成聊天turn**，复用 `conversations/conversations.test.ts` 的公开协议fixture方法；不导入其硬编码数据库生命周期，不启动SDK。它额外计1task/attempt/session，所以每侧129、总258，持续活动仍是128fixture；不能将该合成聊天算native执行。

活动期间每100ms轮换 GET conversation详情与 `turns?after=0&limit=20`，总最多2个在途；同一固定聊天作为轻读基准，不只是读空列表。此项覆盖真实chat投影HTTP在共享池压力下的响应，不覆盖持续native正文/UI渲染。请求3s硬deadline、响应256KiB界限、每侧全程轻读≤200；超时、未发/取消/错误分母分列，不只保成功样本。原task详情/事件读仅作为直接下层参考，不能替代conversation读。

稳定活动采样6秒结束后继续相同背景最多5秒，在固定四个仍活动fixture task上并发发既有cancel命令（各稳定key，只发一次）。记录发送→确定ACK和各attempt收到heartbeat cancel→adapter停止→持久完成的同进程时长/最终身份；中心当前任务取消API即聊天任务使用的取消接缝，但此处不声称浏览器点击或native工具中断。四个取消后不再要求128持续；6秒与取消阶段的分母严格分开。请求未知保原key和资源，不拿新请求/新attempt代替。

候选诊断目标：分别报告轻读p50/p95/max/超时率、取消ACK与停止延迟，列出大于1s轻读或取消ACK的实际样本；1s仅本实验关注阈值，不冒称用户已批准SLO。硬正确性是身份/游标/响应内容一致、ACK与持久事件一致、取消之后不再有新的adapter副作用（已在途报送按原协议排空）、无重复attempt/恢复丢失。不得只因p95好看而忽略超时/unknown。完整ACK丢失/browser/native验收仍属原开放TODO。

## 新预算与运行门禁（提案，未OPEN）

复用原编排规模：全程300s含输入检查、import、准备、两侧、全部收尾/最终持久化/实际外壳退出；prep15s，每侧至多135s，其中工作105s、清理30s。O2开始前至少剩150s、O1有效且全部资源已确认关闭；无重跑。负载实际测量6s+取消尾段≤5s，剩余工作时间只准准备、既定身份/收敛检查，不延长测量等待凑样本。

全量可见字节512MiB：两侧各240MiB、共同32MiB；共同含4MiB最终封存，侧内各含1MiB最终结果，提前计入而不重复收费。source快照/IPC/HTTP/日志/归档/TMP与累积observer都计入；删除不退累计账。默认软停384MiB、原1s低空间检查；采样不是OS硬quota。请求总上限每侧8192（含轻读≤200、取消4、setup/runner/scheduler驱动的HTTP；清理数据库查询不伪装HTTP），总16384；到限停止新工作并保清理余量。任务硬上限258，包括2个聊天setup；未知提交也占数，不复用旧原256合同声称满足。

每侧单随机专库、port0、一个center和一个runner child，最多四个业务children顺序运行；center8+scheduler3+单observer1+admin1=理论13个PG连接，实施时若真实factory闭包出现其它pool必须在ready前修订清单而非运行后隐去。固定库OID+随机marker、CREATE前durable reservation、CREATE ACK确认、PID/PGID即时登记、stdio EOF/组absence分开；normal DROP前本库零连接、无未知操作，未知KEEP。不能FORCE DROP、清旧FKye9L等根或停个人服务。

PG/WAL暂提议1GiB调度额度，不是已测增长或硬cap；512MiB含本实验source/数据/TMP/raw而不重复另加。旧4,053,008,384B共享线及5,663,621,120B组合线仅属于先前A/B历史，不是当前准入门槛。Mika本段告知当前manager最低已6,237,454,336B且Original个人后台窗口优先；此数也不是本新实验的完整sum或OPEN。准备后必须由manager明确每项是否已包含、按当前实际共享预算+本实验新增512MiB+PG/WAL实际预留组成唯一总账；不可动reserve只计一份，不能在不知基数组成时再叠加1GiB或借旧free值。真正OPEN须fresh核完整sum、PG/WAL文件系统、其它队归还与个人窗；DB size末值不等WAL/peak，HOLDER_UNKNOWN不启动。

## 最小实施与直接验证范围

候选精确编辑（均在现claim的mixed目录，但**本段不实施**）：`contract.ts`（新有限recipe参数）、`observe-pg.ts`（现计时上的有限累积策略）、`channel.ts`（有限块交付）、`child.ts`（本地phase/当前v2 claim观测）、`driver.ts`（真实chat轻读/四cancel/界限）、`ab-sequence.ts`/`ab-budget.ts`（复用顺序与预算能力，旧A/B默认常量及断言保持）。新入口建议仅 `queue-probe.ts` 与 `queue-probe.test.ts`；旧ab-main输出/历史合同不能改名重用。准备时若提取共用函数须证明旧行为保持，不复制整套driver/资源监督循环。

当前runtime默认v2机会领取；旧child仅识别路径尾`/claim`，不能直接拿它测当前main。实施必须用当前公开DTO解码同runner/request/attempt/ownerVersion，维持v1观测兼容；不变更生产协议或claim重试规则。这是明确实施缺口，当前只有设计READY，不是可执行SOURCE_READY。

首片不引入checkout map/hold拦截/完整emit偏差采样；它们不是区分IPC交付方式的必要条件，留待首结果再决策。后继必要纯局部验证：callback/promise/error/this透传、累积样本溢出unknown、缓冲chunk字节、同epoch筛选/边界样本、累计预算/前侧失败禁后侧；真实PG专库另验公开chat响应/128持续/四cancel/ACK与持久事件/全部owned cleanup。只测改动模块和直接消费者，不重跑旧64或旧A/B，不把collect/typecheck当真实测量。运行前固定当前baseline完整runtime/动态SQL/依赖closure及实际recipe/input/唯一namespace，单次独审后由co-lead明确OPEN。

## 方法与本段交付

沿已安装本地技能：find-skills SHA c00eeea0…4976f、brainstorming 74edf03e…1608（有界设计，当前授权仅计划）、codebase-design 2c20617f…1e2、clean-code 3c4115e1…6f317（既有sickn33固定来源，不重新安装）。实际应用：将“池排队”改成准确acquisition命名；保单一观察Module/有限delivery策略；取消、未知和资源权威仍由现driver负责；选择两个单变量cell而非全因子矩阵；不通过增加pool掩盖未归因的等待。

本段0工程测试/PG/provider/新observer执行。唯一状态和原六TODO不复制到第二事实源；历史A/B/idle已main和失败原件保持。本设计经只读独审后才能进入实施准备；执行许可必须另有实际窗口。完整S01仍NOT_COMPLETED。
