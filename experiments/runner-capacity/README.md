# S01 本机零模型执行合同

这是可逐步执行的实验合同；已有四任务功能smoke入口，修复复核通过；没有容量结果。只消费固定main `115b0dbdfa02db5483f9e9699852682ce699633c` 的真实 `createServer`、HTTP、`runRunner`、`EventOutbox`。所有新增代码局限本目录；不得把实验内改过的调度逻辑称产品。参数以 [contract.json](contract.json) 为准。

## 先回答的问题与最小场景

128个持久会话存在时，4个独立runner进程是否能在真实PG/HTTP/outbox上同时执行4个确定性任务，并且不超领、不丢事件、关闭浏览器后继续？首轮只有16个任务、4个注册runner且各capacity=1。然后按证据决定是否跑1进程capacity=1与1进程声明capacity=4两个对照；不自动展开所有负载矩阵。

背景通过正式owner API创建128个持久Flow conversation对象并分页核对ID；当前API只支持claude会话，**不提交其模型turn**。因此这是128个无历史turn的会话对象，native session数起始0，实际fixture任务执行产生多少session就报告多少。不能将该场景称128个已恢复原生会话、128个模型或长会话容量；后继有历史会话负载另立片段。实际执行是独立fixture任务，经正式任务API创建，非SQL伪造running行。

子进程运行真实runRunner，仅注入明确标为deterministic的HarnessAdapter（name=fixture）；调用既有fixture行为，追加一个有界本地FS写入/读回SHA256操作并独立计时。每attempt最多一个64KiB操作；只在独有临时目录写文件，不执行shell/网络/模型。这个计数是本实验定义的工具操作，不代表原生SDK工具、所有FS调用或provider吞吐。为保证存在可观察重叠，可设置固定200ms可取消等待；人工等待独立记录，不算CPU工作或工具处理时间。

## 阶段与硬上限

1. **预检/功能smoke**：最多4任务，证明真实center、每个独有runner工作目录、事件明细与清理可追；功能耗时不进入正式分位数。
2. **超领门禁**：最多8任务，注册一个capacity=2 runner，8个并发HTTP claim竞速，断言最多2个未完成attempt且任务身份唯一。protocol-only claim只证明中心上限，不算8个执行agent；用正式事件结束或归属明确的核对清理，不伪改数据库。
3. **首个正式窗口**：128个持久空会话背景、16任务、4进程×1容量。运行前Lead/Web给出互不重叠窗口。所有任务预先受理，记录首claim及实际dispatch-ready观察，避免把调度等待当模型耗时。最多30秒，超时保留失败。
4. **后续对照**：单进程capacity1为16任务，声明capacity4为12任务，1进程×1与1进程声明4，是否执行由首轮证据决定；若执行，预先固定顺序并记录缓存/负载，不反复采样挑最佳。声明4而实际峰值1应作为限制事实，不自动失败或偷偷改生产循环。
5. **丢ACK功能**：最多2任务，一次请求在到达中心前断开，一次中心提交后丢响应；受控loopback代理记录边界。保持原outbox文件/身份，停止并重启相同runner工作目录重放；逐eventId/sequence/payload比对最终DB和HTTP页。若lease失效只允许uncertain/retained事实，不能凭空恢复执行或另开attempt掩盖缺失。功能样本与正式延迟分开。
6. **关闭浏览器功能**：最多2任务。独有浏览器先实际看到running状态/流，保存任务/attempt/cursor；真正关闭该浏览器进程，runner和center为独立进程。确认关闭后有新提交事件与完成产物，再用新浏览器/owner读回。仅关SSE不能标为浏览器关闭；没有浏览器步骤时本项未验证。

合计上限64任务/64attempt：44正式（16+16+12，若全跑）+8smoke（首次4已用、修复后最多再4）+8超领+2ACK+2浏览器。Goal Owner于2026-10-06批准一次重分配，从可选声明capacity4组扣4到功能修复复核；若第二轮失败则停止重跑。各组按真实n报告，不将12写成16。每窗30秒，整个一次实验最多180秒（包含清理，停止新工作时必须保留清理预算）；不自动扩容/重试测量。正式run输出使用wx独占新目录，失败/部分输出永久保留；不覆盖旧结果。最长窗口含失败与清理单独记。0模型/0云，证据+临时数据预算64MiB，单响应体最多1MiB；超界即停止新增工作并正常清理。

## 必须分开报告的计数

| 计数 | 观察来源与意义 |
| --- | --- |
| 持久Flow会话/turn | owner分页精确ID集，与自有库只读计数交叉检查；本首片turn=0 |
| native sessions | 自有库flow.sessions实际行数及harness，不能替代conversation数 |
| 总任务/排队/在途/terminal | 每task唯一ID，提交、claim、完成事件的全生命周期 |
| 未完成attempt | 真实claim响应与server记录；runner/任务双归属，峰值及采样时间 |
| runner声明/有效容量 | 注册值、独立PID、adapter开始结束区间；有效值按重叠区间最大值，不能仅按100ms采样猜峰值 |
| 工具并发 | 本次有界FS/hash操作开始/结束区间；与attempt并发分开 |
| 中心连接 | Fastify server实际TCP连接数、在途HTTP请求数、SSE连接数分别记录；PG按专库/application_name区分observer与center+scheduler合并连接数及wait_event采样（当前两生产pool共用URL，无法可靠拆开center与scheduler），不把pool最大值当已使用连接 |

跨进程计数以父进程IPC事件接收时间与子进程单调起止时钟分别保存；IPC延迟只影响全局近似边界。用首次claim初始租期推导的领取区间与中心completed_at核对容量；量化边界内不能排除重叠时记精度不足；不把不同时钟绝对值直接相减。

## 延迟、正确性与资源记录

- **队列等待**：PG同一时钟task.created_at→首次claim返回的leaseExpiresAt减remainingLeaseMs推导时刻（attempt表没有creation/claim时间列；只保留首次成功assignment租期，不使用会被heartbeat更新的DB租期。claim序列化及task时间各有毫秒量化，差值保守按2ms精度余量；不是精确持久claim时间）；单列admission HTTP耗时、dispatch-ready首次观察和claim请求RTT。因dispatch-ready无持久时间戳，轮询观察只能给区间，不宣称精确调度时刻。
- **事件**：runtime emit开始→ACK收到（包含outbox落盘），以及HTTP提交→响应体完整读取；原始每次时长、字节和event身份一起保存。重放/故障样本不混入正常分位数；成功、失败、重报分别计数。
- **轻读取**：有执行负载时每次请求完成后等待100ms，以单个await循环轮换读取（single-flight，不累积定时器请求；不意味着每个端点均每100ms读取）固定任务snapshot、events增量页、workspace增量页、conversations首屏，逐端点单列实际n/成功错误/UTF-8字节/首次请求与steady样本。详情不预取；只在核对产物时按引用读取。
- **统计**：保留全部原始样本，nearest-rank p50/p95/p99及n。16个排队样本的p99即该批最大值，只是经验值；不称产品SLO、稳态尾延迟或统计显著性。故障/超时不能删去。记录Node24/pnpm9.15.4/Vitest4.0.18、PG版本、硬件、loadavg、实际进程RSS/CPU、配置与源hash。
- **通过条件**：每runner未完成attempt不超过声明capacity；每task同时至多一有效attempt；首轮证实实际重叠达到4或明确记录限制；server事件集/顺序/内容摘要与outbox发送记录一致，无丢失或额外重放；固定产物digest与verification一致；浏览器关闭后执行继续；全部独有资源已关闭。任一未验证项单列，不用其他通过项抵消。
- **观察开销**：一条专用只读PG连接、最多一个轻读循环、一个浏览器/stream；观察开销和查询数单列。pool等待若没有直接计时只能标未测，不能从PG连接数推算。

## 所有权与清理

每次创建唯一 `flow_s01_<pid>_<uuid>` 数据库，遇已存在立即拒绝，不清空共享库。中心/loopback代理/页面端口由OS动态分配，记录绑定后地址；所有监听仅127.0.0.1。最多4个本人子runner，独有临时工作目录及凭据只经受控环境传入，不写stdout/证据；网络目的地限制本实验loopback。

finally顺序：停止新增任务和读循环→关闭本人浏览器/代理连接→Abort/SIGTERM本人runner并限时等待→必要时仅对本人仍活PID SIGKILL并标记异常→关闭本人center/scheduler→关闭观察pool→确认专库连接为0再DROP→删除本人临时文件。无权停止他人服务或强制驱逐共享DB连接。每一步记录成功/失败及PID/端口/库不存在的最终独立观察；无法证明清理不能写全部完成。

正式运行必须绑定实施commit与固定基线及当时实际source hash。功能入口为 `experiments/runner-capacity/smoke.ts`，需要本机专用PostgreSQL的 `FLOW_S01_ADMIN_URL`（不输出值）。从本worktree以Node24运行：`node --import tsx experiments/runner-capacity/smoke.ts <全新证据标签>`，并设置 `TSX_TSCONFIG_PATH=experiments/runner-capacity/tsconfig.json`。目录拒绝覆盖；4任务/2个runner，30秒含清理，工作预算20秒。正式四进程入口已实现待独审/窗口；8任务超领门禁已准备待review/窗口；故障/浏览器仍待实现。runner HTTP计量包装会完整读取响应后重新构造Response，此观察开销属于实验配置，不能将延迟当无观察器的生产值。

首轮功能结果整体FAIL：固定bfe49a4的smoke-first因校验SQL引用不存在的attempt.created_at失败；4任务完成与24事件核验、ACK/outbox/资源清理通过只是部分事实。原结果不改写。修复依据实际schema并由独立worker核对首次租期推导方法，第二轮另用新目录。

修复复核固定实现 `53c8713cb8e6a3c9b7d869c896656dad4e7a086d`：smoke-repair整体PASS，4任务/24事件/4工具，源前后hash一致，3自有进程exit0、DB与outbox清空。两次smoke总8任务额度已耗尽，不再运行；正式后继未执行。见 [固定证据](../../docs/evidence/s01/smoke-manifest.json)。

## 首个正式入口（未运行）

`node --import tsx experiments/runner-capacity/formal.ts <新标签>`，沿用Node24/TSX_TSCONFIG_PATH/FLOW_S01_ADMIN_URL，并必须设置已协调窗口的 `FLOW_S01_WINDOW_ID`。该标识是协调回执索引，不是自动获得窗口。再次执行已记录的同scenario会拒绝。旧smoke入口已封闭以遵守8任务额度；历史结果对应各自固定commit。

正式场景128空会话需完整分页与DB数量核对；16任务全部先受理，4个独立runner就绪后同一IPC门放行。启动等待与setup另分相位，不算模型执行。人工200ms可取消等待置于实验adapter包装内并记录起止，API fixture.delayMs设0，随后仍调用原fixture adapter。每个工具只有一次64KiB读写hash，独立记录工具/adapter/等待区间。

实际事件分层校验：96 runner events；80 task timeline；workspace含16 accepted共96。三个游标空间分别核对，轻读与最终追赶/详情验证的延迟不混算；正文仅最终按artifact detail引用获取。首次dispatch-ready已true表示左侧未知，保留SQL请求边界，不推造精确调度时刻。PG observer有独立URL app name并观察实际连接；center与scheduler只能合并报告，pool获取等待未测。正式场景不打开SSE，因此应报告0；实际关闭浏览器仍属后继独立功能，不以此替代。

3个纯统计单测与noEmit通过，只验证nearest-rank、小样本/非法输入、半开区间与IPC/子进程时钟分离；没有运行正式负载，也没有容量结果。正式之前先在同一已协调窗口运行 `protocol-gate.ts <新标签>`：8个预先ready的任务，8个并发HTTP claim竞争capacity2，必须恰好2个唯一attempt/任务；用正式取消事件及owner cancel使8任务terminal，0 adapter/runner进程。gate与正式各自独有DB、各30秒含清理；gate失败就停止，不启动16任务正式场景。gate首次run-start即封存运行权，失败不能换label自动重跑。

窗口准备复审修复：所有任务terminal后立即退出轻读循环，四个端点即使n=0也列出；按最近SQL观察的running数区分active/queue-only，读取过程中是否恰好完成不作精确保证。gate存储核算包含既有evidence、run-start、owned-process、DB和最终pretty JSON。读取实际PG版本。共用运行回执先检查累计64 tasks/attempts及180秒预算、同scenario禁止重跑、旧未完成run需人工核资源；正式场景还要求已记录成功gate，不能绕过先后次序。新增budget单测3，加统计3，共6通过/noEmit0，未执行gate/formal。

## W2 声明容量对照入口

Goal Owner已批准准备1进程capacity4/12任务；方法及预算见[W2准备说明](../../docs/evidence/s01/w2-readiness.md)。入口为`declared-four.ts`，必须在源码独审及具体窗口批准后运行，环境变量与正式入口相同；不开放更多smoke或capacity1对照。实际并发作为测量输出，不把声明capacity当通过事实。
