# R05C 工程证据

Stack：Node24.20.0 / pnpm9.15.4 / Vitest4.0.18 / TypeScript；local find-skills发现已有适用方法，读取并应用 /Users/citrine/.agents/skills/find-skills/SKILL.md、codebase-design/SKILL.md、clean-code/SKILL.md。采用小显式错误合同隐藏原生细节，复用状态权威；行为测试直接覆盖durability/取消/并发，而非只测构造器。clean-code沿docs/quality/skills.md固定sickn33来源，不重复安装。brainstorming沿已授权两小步设计，不增加审批。

首次新WT CLI因未bootstrap依赖缺pg而失败，未取到claim；随后使用main现有协调CLI只读freshledger与原子take成功，未用main workspace symlink运行分支代码。receipt见claim.json。B1已main3418，owner receipt979fa26并push、release v3（predecessor-release.json），停止B1写入。

实际检查保存stdout/exit/selected与来源；早期与最终结果分开，失败记录保留，不以计划代替运行。

## C0 实施与验证

原生失败显式settled/unknown，普通Error与结构相似的untrusted对象保持既有failed；unknown通过既有lost路径停止续租，不发completed、不清journal。若cancel已先到，额外结算值仅阻止误报cancelled，未更改AttemptControl先到理由规则。两个已在运行slot中，一项unknown不取消另一项；后一项可结算，未知assignment继续阻止补位和重启。

固定环境：离线lock安装成功，540复用/0下载，3.9s，manifest/lock无变化。原始安装输出bootstrap.stdout/exit来源bootstrap.json。实际显式6文件92不同检查通过，含runner33、S01并发23、lease23、admission8、outbox4、resume1；原始进程输出及exit保存在c0-tests.stdout/json。S01真实PG每次随机独立库，四个cleanup remaining均空；lease既有独占flow_r03 advisory保护，正常清理。没有停止他人服务。

最终test改为只依赖公开context.task.prompt后，单选并发检查1通过/32未选，见c0-concurrency-selected.stdout/json，不重复计入92。全workspace noEmit退出码见c0-typecheck.json与原stdout；不是全库行为测试。

Clean-code复核：2026-10-06 09:33:55 UTC，3源码文件。新class只传固定结算证据，不透传原生正文；无新调度器、存储状态或错误文本猜测。保留普通异常、取消、ownership lost、outbox与并发状态所有权，6条新增行为覆盖journal/重启/取消顺序/并发而非构造器。C1映射/deny/JSONL-to-PG尚未实现，不由本组通过推断。

## C1 固定投影入口提升

Mika回执许可只读提升固定0d0524c3439363d1fe60aad63f62817ba51fa2a5的final.mjs至apps/runner/src/native-harness/codex/projection.mjs，原算法逐字相同，SHA256见projection-source.json。公开入口createOrdinaryFinalProjection({threadId,turnId}).accept(notification)及声明projection.d.mts。没有写实验scope；提升入口已获Execution Lead独审并进入main；Mika负责将实验改为薄import，实验迁移事实由其owner记录。

独立临时消费者用同一固定来源的15项final测试，仅把一次module import指向生产入口，其余断言字节保持；Node24实际15/15，原始输出/来源哈希见projection-tests.stdout/json，临时目录正常清理。此组证明算法提升，不证明C1宿主/deny/原生执行。原AssertionError可能携带原生内容，生产adapter必须归一且不保留cause；入口注释/Interface明确该约束。

## C1 已固定的普通任务纵向片段

源码target：7127b5bfda3135670e1595dd4b6e90c4c9ea416c，13个literal文件见c1-fixed-manifest.json；源码冻结，Execution Lead独立只读APPROVED。已审C0与projection未修改。F01受控输入095bdb849a4ba688be7c2b55d90021b9d15e4b53原样cherry-pick为fa39510aca91e032af7925cd79e81d27873da03c，两个共享文件没有本owner新改动，见c1-shared-inputs.json。main253035e11ab18ba33095c018949f856442021d49包含C0/projection/client；C1已审并进入main f181d84b5fb3652d62e2a181acff442d42b3e066。

configureCodexHarness显式组合R06 transport factory、冻结的严格profile、现有descriptor/guard。没有默认executable、环境或个人配置入口。宿主仍独占claim、lease、journal、outbox和completed；adapter只映射一个普通turn、拒绝原生server requests、验证有界final evidence并调用原有verifier。旧Claude发布方法/编码行为通过直接消费者保持。抽象仅增加真实第二实现所需的泛型profile边界，无新SDK loop或第二运行状态权威。

进程用真实R06 JSONL管道连接受控Node peer，绝非实际Codex。公开profile publication与submit触发现有runRunner claim/outbox，经完整migration的随机独立PG库验证轻量列表、final详情、namespace/ID、顺序、artifact、verification、unknown usage与reservation释放。拒绝命令申请、完整terminal.items发现MCP、EOF均没有session/final事件，保持admission与uncertain reservation；重启不启动第二进程。两次真实随机数据库均正常删除，每场景仅自有一个Node子进程且确认退出。撤销runner后不再派发turn/final。没有app-server/auth/provider调用。

### 验证口径

- 最终adapter44 + evidence边界4：48/48，c1-final-adapter-tests.stdout/json。原43/43早期结果保留但不重复计数。覆盖10种固定schema server-request及未知method、响应前denial交错、14类工具/未知item（started与terminal-only）、身份/phase/多final/晚到/断连/丢response/字节上限/未确认关闭、native failed/interrupted、host时间/输出限制与未pin/resume/预取消。
- 直接消费者6文件42/42：runner profile13、native descriptor8、旧configuration15、旧client profile2、新client profile1、合同3，c1-consumers.stdout/json。
- PG纵向5项：首次4通过/1失败（测试查询误用不存在的details.created_at）；修复为现有timeline.cursor联表，保留原顺序与内容断言。只重跑受影响成功项：1通过/4未选，c1-pg-selected.stdout/json。c1-pg-tests.stdout/json保留失败，不伪称一次完整5/5。
- C1合计95个不同检查有通过证据。projection的原15项、C0的92项是先前已审片段，不重复计入C1。最终workspace noEmit exit0，c1-typecheck.stdout/json；不是全库行为测试。

PG资源采样c1-pg-resources.json与c1-pg-selected-resources.json记录6次自有进程执行、全部确认关闭、两库删除。R06待消费队列peakInboundBytes为0–743、peakOutboundBytes为360–559；是这6次fixture的队列峰值，不是全进程内存、生产吞吐或性能提升结论。独立evidence测试证明未绑定缓存64通知/2MiB、总观察256通知/4MiB上限；R06保持既有wire/backpressure/close界限。没有截断正文后伪成功。

### 能力与错误边界

access:none只是Flow请求意图。never/readOnly/networkAccess:false与收到的相同thread配置不证明没有执行工具。逐项拒绝全部固定server-request；任何请求、工具item、未知通知、阶段或关闭证据异常均拒绝final，保留unknown，不把拒绝回复当成工具未运行的证明。actualExecution五项维持unknown/null，provider usage不猜测；不套Claude美元/turn预算。

该片只ordinary final，stream/resume/steer/goal/context不受支持。允许忽略有界文本/reasoning delta，不提供产品流式能力。取消/超时关闭自有transport；没有依赖turn/interrupt ACK来宣称远端停止。本地child退出只是资源释放证据，终态未确认仍unknown且不发completed。已经确认原生failed/interrupted可settled失败；已确认正常终态但超出host输出上限也settled失败。所有投影/协议异常归一成固定NativeExecutionError，无raw/cause/actual/expected日志；unknown不发布session/final。真实provider、账户可用性、模型目录、effective工具隔离与预算另行验收。

Clean-code复核：2026-10-06 09:51:14 UTC，C1的13源与固定共享输入边界。单一投影/单一R06接收者；wire只投影需要字段，policy有限deny，evidence只持有有界临时身份/帧，adapter负责组合与释放；修复无用test export，新增响应前拒绝与缓存界限证据。未增加框架/默认可执行项，未复制宿主状态机。无已知未解决owner finding；后续Execution Lead独立review获批，无P1/P2。

C1独审回执：Execution Lead核13源/47个manifest条目/7既审输入与95不同检查、tsc0，未重跑且0provider；APPROVED target7127b5bfda3135670e1595dd4b6e90c4c9ea416c。批准边界与完整结论见唯一review.md；main receipt已接，见main-receipt.json；13源逐字相同，Lead组合35检查/root types通过；本次metadata push后停止旧scope写入并释放claim，不追最新metadata循环。
