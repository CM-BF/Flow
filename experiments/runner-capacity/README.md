# S01 本机零模型执行合同

这是可逐步执行的实验合同；已有四任务功能smoke入口，尚未运行，没有容量结果。只消费固定main `115b0dbdfa02db5483f9e9699852682ce699633c` 的真实 `createServer`、HTTP、`runRunner`、`EventOutbox`。所有新增代码局限本目录；不得把实验内改过的调度逻辑称产品。参数以 [contract.json](contract.json) 为准。

## 先回答的问题与最小场景

128个持久会话存在时，4个独立runner进程是否能在真实PG/HTTP/outbox上同时执行4个确定性任务，并且不超领、不丢事件、关闭浏览器后继续？首轮只有16个任务、4个注册runner且各capacity=1。然后按证据决定是否跑1进程capacity=1与1进程声明capacity=4两个对照；不自动展开所有负载矩阵。

背景通过正式owner API创建128个持久Flow conversation对象并分页核对ID；当前API只支持claude会话，**不提交其模型turn**。因此这是128个无历史turn的会话对象，native session数起始0，实际fixture任务执行产生多少session就报告多少。不能将该场景称128个已恢复原生会话、128个模型或长会话容量；后继有历史会话负载另立片段。实际执行是独立fixture任务，经正式任务API创建，非SQL伪造running行。

子进程运行真实runRunner，仅注入明确标为deterministic的HarnessAdapter（name=fixture）；调用既有fixture行为，追加一个有界本地FS写入/读回SHA256操作并独立计时。每attempt最多一个64KiB操作；只在独有临时目录写文件，不执行shell/网络/模型。这个计数是本实验定义的工具操作，不代表原生SDK工具、所有FS调用或provider吞吐。为保证存在可观察重叠，可设置固定200ms可取消等待；人工等待独立记录，不算CPU工作或工具处理时间。

## 阶段与硬上限

1. **预检/功能smoke**：最多4任务，证明真实center、每个独有runner工作目录、事件明细与清理可追；功能耗时不进入正式分位数。
2. **超领门禁**：最多8任务，注册一个capacity=2 runner，8个并发HTTP claim竞速，断言最多2个未完成attempt且任务身份唯一。protocol-only claim只证明中心上限，不算8个执行agent；用正式事件结束或归属明确的核对清理，不伪改数据库。
3. **首个正式窗口**：128个持久空会话背景、16任务、4进程×1容量。运行前Lead/Web给出互不重叠窗口。所有任务预先受理，记录首claim及实际dispatch-ready观察，避免把调度等待当模型耗时。最多30秒，超时保留失败。
4. **后续对照**：各16任务，1进程×1与1进程声明4，是否执行由首轮证据决定；若执行，预先固定顺序并记录缓存/负载，不反复采样挑最佳。声明4而实际峰值1应作为限制事实，不自动失败或偷偷改生产循环。
5. **丢ACK功能**：最多2任务，一次请求在到达中心前断开，一次中心提交后丢响应；受控loopback代理记录边界。保持原outbox文件/身份，停止并重启相同runner工作目录重放；逐eventId/sequence/payload比对最终DB和HTTP页。若lease失效只允许uncertain/retained事实，不能凭空恢复执行或另开attempt掩盖缺失。功能样本与正式延迟分开。
6. **关闭浏览器功能**：最多2任务。独有浏览器先实际看到running状态/流，保存任务/attempt/cursor；真正关闭该浏览器进程，runner和center为独立进程。确认关闭后有新提交事件与完成产物，再用新浏览器/owner读回。仅关SSE不能标为浏览器关闭；没有浏览器步骤时本项未验证。

合计上限64任务/64attempt：48正式（若全跑）+4smoke+8超领+2ACK+2浏览器。每窗30秒，整个一次实验最多180秒（包含清理，停止新工作时必须保留清理预算）；不自动扩容/重试测量。正式run输出使用wx独占新目录，失败/部分输出永久保留；不覆盖旧结果。最长窗口含失败与清理单独记。0模型/0云，证据+临时数据预算64MiB，单响应体最多1MiB；超界即停止新增工作并正常清理。

## 必须分开报告的计数

| 计数 | 观察来源与意义 |
| --- | --- |
| 持久Flow会话/turn | owner分页精确ID集，与自有库只读计数交叉检查；本首片turn=0 |
| native sessions | 自有库flow.sessions实际行数及harness，不能替代conversation数 |
| 总任务/排队/在途/terminal | 每task唯一ID，提交、claim、完成事件的全生命周期 |
| 未完成attempt | 真实claim响应与server记录；runner/任务双归属，峰值及采样时间 |
| runner声明/有效容量 | 注册值、独立PID、adapter开始结束区间；有效值按重叠区间最大值，不能仅按100ms采样猜峰值 |
| 工具并发 | 本次有界FS/hash操作开始/结束区间；与attempt并发分开 |
| 中心连接 | Fastify server实际TCP连接数、在途HTTP请求数、SSE连接数分别记录；PG按专库/application_name分center/scheduler/observer连接数及wait_event采样，不把pool最大值当已使用连接 |

跨进程计数以父进程IPC事件接收时间与子进程单调起止时钟分别保存；IPC延迟只影响全局近似边界。用中心attempt精确生命周期核对超过容量的区间；不把不同时钟绝对值直接相减。

## 延迟、正确性与资源记录

- **队列等待**：PG同一时钟task.created_at→attempt.created_at；单列admission HTTP耗时、dispatch-ready首次观察和claim请求RTT。因dispatch-ready无持久时间戳，轮询观察只能给区间，不宣称精确调度时刻。
- **事件**：runtime emit开始→ACK收到（包含outbox落盘），以及HTTP提交→响应体完整读取；原始每次时长、字节和event身份一起保存。重放/故障样本不混入正常分位数；成功、失败、重报分别计数。
- **轻读取**：有执行负载时每100ms以单个await循环轮换读取（single-flight，不累积定时器请求）固定任务snapshot、events增量页、workspace增量页、conversations首屏，逐端点单列实际n/成功错误/UTF-8字节/首次请求与steady样本。详情不预取；只在核对产物时按引用读取。
- **统计**：保留全部原始样本，nearest-rank p50/p95/p99及n。16个排队样本的p99即该批最大值，只是经验值；不称产品SLO、稳态尾延迟或统计显著性。故障/超时不能删去。记录Node24/pnpm9.15.4/Vitest4.0.18、PG版本、硬件、loadavg、实际进程RSS/CPU、配置与源hash。
- **通过条件**：每runner未完成attempt不超过声明capacity；每task同时至多一有效attempt；首轮证实实际重叠达到4或明确记录限制；server事件集/顺序/内容摘要与outbox发送记录一致，无丢失或额外重放；固定产物digest与verification一致；浏览器关闭后执行继续；全部独有资源已关闭。任一未验证项单列，不用其他通过项抵消。
- **观察开销**：一条专用只读PG连接、最多一个轻读循环、一个浏览器/stream；观察开销和查询数单列。pool等待若没有直接计时只能标未测，不能从PG连接数推算。

## 所有权与清理

每次创建唯一 `flow_s01_<pid>_<uuid>` 数据库，遇已存在立即拒绝，不清空共享库。中心/loopback代理/页面端口由OS动态分配，记录绑定后地址；所有监听仅127.0.0.1。最多4个本人子runner，独有临时工作目录及凭据只经受控环境传入，不写stdout/证据；网络目的地限制本实验loopback。

finally顺序：停止新增任务和读循环→关闭本人浏览器/代理连接→Abort/SIGTERM本人runner并限时等待→必要时仅对本人仍活PID SIGKILL并标记异常→关闭本人center/scheduler→关闭观察pool→确认专库连接为0再DROP→删除本人临时文件。无权停止他人服务或强制驱逐共享DB连接。每一步记录成功/失败及PID/端口/库不存在的最终独立观察；无法证明清理不能写全部完成。

正式运行必须绑定实施commit与固定基线及当时实际source hash。功能入口为 `experiments/runner-capacity/smoke.ts`，需要本机专用PostgreSQL的 `FLOW_S01_ADMIN_URL`（不输出值）。从本worktree以Node24运行：`node --import tsx experiments/runner-capacity/smoke.ts <全新证据标签>`，并设置 `TSX_TSCONFIG_PATH=experiments/runner-capacity/tsconfig.json`。目录拒绝覆盖；4任务/2个runner，30秒含清理，工作预算20秒。正式场景和故障/浏览器入口尚未实现。runner HTTP计量包装会完整读取响应后重新构造Response，此观察开销属于实验配置，不能将延迟当无观察器的生产值。
