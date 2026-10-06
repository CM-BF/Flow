# S01P01：单 runner 的有限并发与保守领取恢复

当前测试兼容修复实现 `48b73544c0e9e66a7061ddb54e003a03b9234bde`（原产品批准 `d655a3315bf8d967f4c822969e1a0b72952dc493`），base `9c6fa9b100f04916f43b04280f05f497b28eeb0f`。本片修改 runtime/journal 及两个专用测试；不修改中心、outbox、AttemptControl、SDK、CLI/config。`RunnerOptions.maxConcurrentAttempts` 默认1，显式整数1..16；CLI配置接线由其owner负责，不能把这片当CLI选项已上线。

一个领取/恢复循环管理有限attempt Map。每个attempt复用原独立控制器、outbox、decision及steering。中心registered capacity/session排他仍权威。普通失败/取消只结束对应slot；401凭据错误或403 `wrong_role`、全局abort、EventStorageError停止领取，收束所有已起slot及未决API。goal scope等403保持局部授权失败。

`AdmissionJournal` 的scope是原baseUrl规范化摘要+workdir，假定单个runtime拥有此目录，不是跨进程互斥锁。领取前未知runner身份，只落随机intent，不落token/prompt。明确assignment以一个fsync+原子rename同时保存绑定/清intent，然后才execute；只有完成事件的合法ACK可清绑定。已知绑定最多16，重启降低local limit不丢弃。读取最多64KiB且拒绝非普通文件、symlink/FIFO；临时文件独占创建，意外对象/崩溃临时文件保守失败。

启动及active=0才恢复全目录；活动outbox不被另一slot重放。旧completed ACK重放可以清绑定；confirmed-final不等于completed。未知claim/崩溃残留没有中心requestId/回执查询，本片无自动解除或重执行接口，需受控核对；不会凭租期过期或本地active=0宣称中心空闲。若需要恢复，先等其它已知attempt收束。

## 检查

Node24.20.0 / pnpm9.15.4 / Vitest4.0.18，固定本WT `@flow/*` paths，只复用既有依赖，无安装。完整命令/UTC/exit/source SHA在各 `*-result.json`，原stdout/stderr在对应log。

| 最终行为组 | 通过 / 选择 | 证据 |
| --- | --- | --- |
| Journal真实文件/重启/并发更新/FIFO子进程 | 8 / 8 | journal-final |
| 有限slot/故障隔离/真实PG中心/授权 | 23 / 23 | capacity-final |
| 旧runner恢复/ACK/final-proposal | 9 / 27；18未选 | consumer-final |
| 旧单调租期与storage/shutdown | 6 / 23；17未选，固定PG用例未运行 | lease-final |
| noEmit | exit0 | types-final |

合计 **46个不同用例**。这些行为检查后最后仅追加实例API未决Promise的最终等待，差异保存在 `final-transport-seam.diff`；定向 `capacity-settle` 7/23、`lease-settle` 6/23 与 `types-settle` exit0绑定最终7个source/harness字节，重复用例不累加。未再跑PG或容量矩阵。先前46组与最终runtime的关系明确记录，不冒充全部46在最终字节上重新执行。

真实PG/HTTP使用唯一UUID数据库、动态端口、同WT真实createServer，`leaseMs=300000`、`automaticQueueScan=false`（scheduler仍在）。容量1/4与local4、同native session、draining/uncertain及hold拒绝都有实际中心断言。两轮共8个自有库均记录remaining=[]并普通DROP；测试仅合成adapter，0provider/model/cloud。首PG轮capacity4清理时中心达到HTTP drain期限并关闭自有剩余连接，原警告保留，不能泛称全轮无连接强制关闭；fixture后改先关闭自有idle连接，最终轮无该警告。无他人服务/旧固定库操作。

## 失败与修复

- journal-red：模块尚未存在，收集失败，0测试不能算通过；随后首6个文件行为绿。
- capacity-red：旧串行runtime不能进入四slot，选中1失败、11未选。
- capacity-first：10/12；fixture使用不存在的log事件导致一个等待超时；正常完成错误地触发恢复barrier导致另一个容量场景停领。
- capacity-fixture-fixed：修正message事件后11/12；移除正常完成的多余恢复barrier后12/12。
- types-first：对应错误事件类型3项诊断；修正后noEmit0。
- Mika预审P2：FIFO读及tmp写会阻塞。journal-fifo-red两子进程均在2秒上限被SIGTERM回收，随后O_NONBLOCK/fstat、短读循环、tmp独占创建，8项全绿。
- Mika预审P2：不能把goal权限403当host认证错误。现401/403 wrong_role才停止host，scope拒绝局部处理；双slot与吞错路径测试通过。

原日志均冻结。`source-history.json`保存所有历史product/test采样哈希的逐字复核快照；从git/明确变更重建的版本仅在hash完全一致后入档。当前 `manifest-final.json`（原`manifest.json`保留0bf71a3） 区分source、readonly消费者、原raw和历史版本，不把旧测试源码当当前版本。

这些是功能与恢复证据，不是吞吐/SLO/provider容量；没有运行S01/P01性能矩阵。原session/中心uncertain责任不变，unknown guard的保守可用性损失与单目录单runtime假设保留。Mika独立技术review及Goal Owner范围接收、main集成另记；当前不是main能力声明。

Mika正式review的测试可移植性P2：FIFO测试移除本机loader/证据tsconfig绝对路径，默认从当前项目依赖解析tsx并用正常配置；本机复用安装仅check.mjs传入显式测试环境覆盖。原root package已声明tsx4.23.15。journal-portable8/8、types-portable0绑定新7文件，runtime/journal产品源码对0bf71a3逐字不变；未追加PG/不同用例，也未声称此未安装依赖的WT已运行默认解析分支。

2026-10-06 08:30:14 UTC：Mika独立只读review **APPROVED** 固定d655a331；三项P2关闭，无剩余P1/P2，详见`independent-review.json`。原raw/manifest冻结；当前待main集成。reviewer无测试/PG/provider/服务操作。

2026-10-06 08:37 UTC：集成发现根ES2023不支持测试withResolvers，局部ES2024覆盖掩盖错误。保留integration-es2023-failure.log与本地types-es2023-red，现改为本地void deferred并继承根lib；5受影响纯HTTP通过/18未选及严格noEmit0。编译覆盖4owned入口与137worktree transitive source，根选项与I02一致，未声称完整root glob通过。原46与PG证据不重跑；原产品不变，新target/delta与9原始证据见manifest-es2023.json，待Mika复审和Lead集成。

2026-10-06 08:39:29 UTC：Mika独立只读**APPROVED**当前48b73544兼容delta，无剩余P1/P2。见independent-review-es2023.json；7source/9raw、根选项/局部覆盖、5选中HTTP与产品零差异已核。最终完整root检查与main接收仍由Lead完成；原manifest/raw冻结，本次无新测试。
