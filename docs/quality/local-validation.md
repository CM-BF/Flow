# 局部验证与交付速度

2026-10-06 02:32 UTC。使用本地 find-skills / codebase-design / clean-code；方法依据固定 pnpm9.15.4 / Vitest4.0.18 与现有 manifest，不推断未来版本能力。

| 改动面 | 可执行入口与直接影响 |
| --- | --- |
| 中心业务 | `pnpm exec vitest run apps/server/src/<affected>.test.ts`；命令/ownership/迁移改动加 server.test.ts 中对应路径 |
| Runner | 显式 `apps/runner/src/` 内受影响测试路径；outbox/control/adapter 变化覆盖其公开行为 |
| Contracts | 显式 `packages/contracts/src/<domain>.test.ts`，再选 server/client/runner/CLI 中直接消费行为；只类型检查不替代 SQL/运行时协议 |
| Client / CLI | `pnpm exec vitest run packages/client/src/client.test.ts apps/cli/src/cli.test.ts`；若只改一侧，按依赖选相应文件 |
| 协议 | `pnpm exec vitest run packages/protocols/test/<affected>.test.ts`，真实官方peer与专用PG按影响选择 |
| 产品Web | 已存在 `pnpm --filter @flow/web test` / `typecheck` / `build`；浏览器只跑相关旅程和真实共享接口集成 |
| Dashboard | 该包已有 Node tests；聚合/证明逻辑与实际临时 HTTP 验证，样式才需相关真实browser/截图 |
| 文档 / 状态 | 链接、task ID、事实/target/范围、diff，不跑全库 |

上表不是一律要运行全部命令。每次记录实际命令、选中数、通过/未选中数、专用DB/动态端口、耗时和已知边界；零测试失败，不能把无包script当通过。根fileParallelism:false暂时保留，未凭推测全局并行。后续先按耗时拆纯逻辑与独占DB集成组，再决定调度改变。

本段实例：M02因果投影修复先红1项，修后模块6/6约4.15秒，独立review选择201task/latecommit2/2；公共接口未变，没有重复全库93项。clean-code检查关注新不变量局部表达与不引入无关抽象。

2026-10-06 05:01 UTC汇总维护：find-skills本地clean-code/codebase-design复用同一管理任务，核权威owner/实际main；仅文档/相对链接/diff检查，不重跑产品或B02/CTX01负载。完整原要求未删，summary以用户可获得能力表达。

## 运行窗口前的入口核对（2026-10-06 16:59 UTC）

在已有局部验证准备中，先从**将要实际启动的固定入口**做小范围静态核对：除了 TypeScript import，还检查迁移固定数组/模板 URL、fixture 与配置文件、包入口及实际文件读取路径。只核本次执行闭包和确定路径，不做全库扫描或新验证框架；缺件由合法 owner/唯一 Git operator 补齐。静态齐备不等于 import、迁移或运行通过。

浏览器旅程在实际挂载视图中检查 locator 的角色、范围与唯一性，区分工具栏、会话标题及重复名称；已有真实 DOM/固定 App 证据可直接复用，不能把定位器异常报告成产品行为失败。修改定位器只补受影响旅程，不重跑未变的 HTTP 前置。

2026-10-06 两个实例：CORE 的 beforeAll 因两组动态迁移数组中的 4 份 SQL 未物化而使 8 例全部 skipped；补齐 5,539 B 后独立只读核真实 28 SQL/175 本地源/10 包入口，原失败保留，实际 PG 在新串行窗口验证。RELEASE03 已通过两个后台历史场景和普通发送，随后同名 Files 定位严格性错误；保留原清理/累计预算，修定位不改过去结果为 PASS。

后续新特征树按实际所属模块一次供给有限的 src/直接测试、fixture、动态 SQL 与包元数据；相关共享包按真实 Module 闭包供给，先量化固定 Git 的逻辑字节，再定小额本树预算。不要为省几十 KiB 反复逐文件/AST 往返；AST import 检查仍不能覆盖 new URL/动态资源。node_modules、build 和其他任务历史 raw 不随源码物化；逻辑字节不称物理配额，也不改变运行余量线。既有树只补明确缺项，保留全部现有 dirty/untracked/固定hash，不重设初始 sparse 或覆盖 writer。S01P07 的33源186,913B与后续 main入口22源93,543B是本次直接实例，后轮全部319份已物化文件保持，0安装/执行。

同范围局部检查由 co-lead 在既有资源和累计预算内自主准入，不逐条向 GO 申请。共享 PG/Chrome 仍由两 lead 明确交接，fresh 准入与实际清理不可省；源码、小检查和完整构建的资源界限分别适用。记录复用唯一 owner status 与原证据，不增加每文件审批或第二账本。已通过且未受改动影响的检查不重复。

## 待实施：复用有限连接观察（2026-10-06 17:50 UTC）

TUI01F与Recovery已遇到pool.end后单次查询的收尾问题；attachment-integration fixture的同类模式目前只是静态风险，不冒称已有失败。固定pg8.23.1→pg-pool3.14.0会先从本地clients移除再异步client.end，await pool.end不能当远端pg_stat_activity零连接的同步屏障；这不证明某一次unknown的根因。

当前固定旅程先收口。后继由独立owner在合法scope检查已有TUI45709c的observeConnections小接口（query/clock可注入），按两个实际消费者决定是否提取test-only共用模块。它只观察有界zero/busy/unknown，不拥有数据库删除权限、资源归属或完整supervisor。新检查复用；不迁移全部fixtures、不造新平台、保留原失败证据。只对直接消费者做必要验证，排在F01/hash/RELEASE解阻之后。

## 固定依赖视图的实际加载（2026-10-06 19:13:01 UTC）

R01 首次隔离旅程在真实 center 已启动后，runner 的 outbox 导入 @flow/client 失败；0 页面报告，清理完成。原 backend-dependency-view-input 仅列 contracts，静态manifest不能证明所有实际工厂入口可加载。保持固定 af51 源和原失败后，只补同树 client 与已装固定 SDK 两个 ignored alias；对实际 center/runner 的四个入口先只导入并核 export，未调用 createServer/runRunner/query，1002ms exit0、0PG/Chrome/provider。正式页面兼容仍需下一原旅程，不由此取代。

后续仅在已核顶层无启动副作用的入口做廉价加载检查；使用正式执行的相同依赖视图，包入口与动态资源分别核。失败给具体缺件和合法 owner 处理，不生成通用依赖扫描器、不自动安装或借移动主线 workspace alias。额外探针也保持有界输出、时间和自有资源清理，不把导入等同于产品或原生模型验收。

## 待实施：复用独立进程期限（2026-10-06 19:45 UTC）

O16与SVC05H中心恢复初审都发现期限依赖operator自身或证据写盘的问题。当前中心恢复的2项定向修复保持其固定审查边界；恢复后沿OPS-001-14安排独立owner，用本地codebase-design/clean-code检查最小可复用的test/operator Module，先覆盖这两个真实消费者。Interface必须明确监督一个PID还是自有组、哪些detached服务永远不由它停止、期限相对何时开始、父进程先退/证据阻塞时如何收尾，以及停止operator不等于外部效果已停止，结果仍可能unknown。

只复用这项生命周期职责；DB删除权、资源归属、源码绑定及OPS-001-13连接观察仍独立。不造通用测试平台，不为了抽象重跑产品或抹掉历史失败；真实复用价值由两个直接消费者和局部故障证据决定。
