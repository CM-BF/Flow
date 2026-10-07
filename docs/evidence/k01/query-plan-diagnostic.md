# K01-06 当前版本词法检索：查询计划诊断准备

状态：PREPARATION_ONLY / NOT_RUN；2026-10-07。唯一权威计划仍为[原K01计划](../../../plans/k01-knowledge-sources/plan.md)的K01-06，本文件是一个诊断记录/后续入口说明，不新建benchmark框架、独立计划或产品权限。Mika授权本次≤10分钟文档段；原K01-08～10留存设计、R01～12及flow.commands生命周期依赖保持原样开放。

## 固定输入与已知事实

产品只读main `3c9345df4aec85a37e8a2a155e079db260d515b1`，文档分支起点 `88bee460c5e0caf762157b3b0934c16093293fe3`，不merge/rebase。下表是Git blob读取后的UTF8文件bytes/SHA256；不复制源码，不导入测试。后续入口须绑定完整实际闭包，不能将这9个重点输入当完整运行依赖闭包。

| 固定Git路径（同上commit） | bytes | SHA256 |
| --- | ---: | --- |
| `apps/server/src/knowledge/search.ts` | 3360 | `e300061702e4557e5fc09c06f6dfdb43d0d1ef9c7b76db30330c4958f72ffb42` |
| `apps/server/src/knowledge/text.ts` | 927 | `f44e78e9214fe76b0513f8080acf71d0546c90d62c440b0617e13a73d0d26ce1` |
| `apps/server/src/knowledge/storage.ts` | 10068 | `72d2cc8663a9d077367e4ce04cf1fdb7a17ed7966ae1f380e12905212abccd21` |
| `apps/server/src/knowledge/index.ts` | 3782 | `28fd0fd2a053c8e1764913cd0a09f1dc9e73576746a38e49bb2b11def94ae5a7` |
| `apps/server/src/knowledge/knowledge.test.ts` | 21935 | `5e5a5a74a5b1d0b8087b8decc8238c07d6f723b7ea379811733df5d89d7d9e0e` |
| `apps/server/src/knowledge/fixture.ts` | 4298 | `4873445fb6634d33462a249a69062025b383621035c740a2d45aa91b719379b7` |
| `apps/server/src/database.ts` | 7789 | `277ab00876c0b904168b4d3f1b2dc2b3221761bb27cb0a8b5e2618e7aa0f5653` |
| `packages/contracts/src/knowledge.ts` | 4414 | `411a5cd8ebdacabc82e8632a29b72e7b565ca0f797f60c06ae3b686b03507f43` |
| `packages/storage/migrations/015-knowledge-sources.sql` | 2406 | `62e81d76141c3b74bd36cb7e38ef98a24f552ac01598c9b7d7c7f88fe812a3c1` |

`searchSources`在同REPEATABLE READ只读事务内先loadProject，再执行SQL。`current_chunks AS MATERIALIZED`内部先join当前version并筛project；CTE外`strpos(content,$2)>0 OR search_vector @@ plainto_tsquery('simple',$2)`，再每source用row_number取winner，最后全局排序与limit+1。015已有GIN(search_vector)，但匹配作用于物化CTE输出，不能把“有索引”当“当前查询用GIN”。此处为源码结构事实/计划假设，实际算子、扫描数、buffer与时间尚未测量。

原17595 chunks容量夹具是255个版本×69块的历史/当前合计，不能充当当前搜索扫描数。该夹具16个source各一current，在两并发create前current为16×69=1104块、历史16491块（根据固定构造推导，不是本次实测）；容量验证不复跑，也不将其空词向量正文视为重FTS成本。

## 有限金样本与语义验收

直接复用固定knowledge.test.ts的12个lexicalCases原文字节和预期，不另发明召回基准：中文两字、中文连续句、camelCase、path、underscore、version、literal-meta、query-syntax、emoji、256-byte-cross-chunk、fts-multiple-words、fts-case-fold。前10应literal且excerpt完整含query，后2为FTS；逐项记录FTS-only与combined source命中，不能用simple FTS替代中文片段或字面 `%`、`_`、反斜线/tsquery标点语义。

复用4组既有语义断言：①project/current过滤与旧版resolve仍可读；②重叠chunk每source只一winner；③literal优先、rank/UUID/ordinal稳定顺序、limit+1/hasMore；④控制字符JSON转义触发真实48KiB envelope截断。另保留query≤256UTF8B/完整边界、excerpt≤512B、完整citation与精确resolve、跨chunk多词不保证/FTS预览未必含词的原边界。金样本oracle是固定原文/预期和独立字节切片，不只比较两版SQL彼此相同。当前没有任何新通过数。

## 拟定最小baseline（尚未获PG窗口）

只一个唯一临时DB、一个动态127.0.0.1 HTTP端口、0runner/task/provider/model/embedding，使用现知识fixture生命周期及生产public search/resolve路径，不写通用运行器。后续合法owner准备一个入口与一份运行记录，固定Node24/pnpm9.15.4/Vitest4.0.18；本次没有可执行入口或可运行命令。共享窗口/真实PG准入和fresh身份/资源由Mika协调，文档批准不是运行许可。

数据规模分三组，固定种子及UUID排序，按合法原文/chunk函数构造，显式汇总每project current/history/foreign块数与raw bytes：

| 数据组 | current search候选 | 历史块 | foreign当前块 | 合成原文量 |
| --- | ---: | ---: | ---: | ---: |
| G：原12金样本+上述语义组 | 实际计数；≤64sources、合计≤256chunks | 单列实际数 | 单列实际数 | ≤512KiB retained raw |
| D16：目标16sources，每source两版、每版精确16KiB UTF8（固定词+ASCII填充，完整codepoint） | 80（5块/版） | 80 | 独立project16sources×5=80 | 768KiB retained raw |
| D128：目标128sources，每source两版、每版16KiB | 640 | 640 | 独立project16sources×5=80 | 4352KiB retained raw |

G≤256是current/history/foreign合计上限。全部数据共≤1856chunks、≤5.5MiB retained raw；chunk重叠字节、索引/表物理体积另记录，不称整个DB同样大小。历史版放独有oldonly，foreign放独有foreignonly；当前包含稀有、常见和无命中查询，不能只用命中率低的漂亮样本。未来seed必须先核实际counts/bytes和original digest，否则stop，不为了符合表格悄改预期。

首轮只跑现SQL baseline：G复用语义组；D16/D128各固定5类查询（中文两字、FTS大写READY、字面%/_/反斜线、alpha beta、全无命中），每场景1次EXPLAIN及3次普通SELECT、1次public HTTP。总上限10份计划、30次普通SQL采样，HTTP包含seed/语义/search/resolve合计≤256。若HTTP seed预计超预算，批量合法SQL seed必须在入口审查说明（不得绕约束/伪称公共写入），保留public search消费验证。不得临时扩矩阵或补warmup追数字。

## 计量口径

- 捕获精确生产SELECT文本/hash及参数（只有合成project/query）、PG16实际版本/统计信息/索引DDL/相关planner设置。专库seed后一次ANALYZE只为稳定统计，计入准备时长；不调pool、work_mem或enable_seqscan。不flush缓存、不重启PG，首请求只称first-observed/cache unknown；后续3样本单独标重复读取。
- 每场景保留完整`EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON, TIMING OFF)`原JSON。ANALYZE确实执行查询；计划Execution/Planning Time与普通SELECT/HTTP壁钟分开。记录CTE生成/扫描节点、基表scan实际rows×loops、Rows Removed by Filter/Join Filter、匹配chunk数、winner/source数、最终limit行数、sort/window、buffer hit/read/temp与索引名。不同节点不可相加冒充唯一扫描行数；loops均值/四舍五入明确，索引recheck和bitmap heap不同层分别报。
- 普通查询计数分BEGIN/COMMIT、project SELECT、search SELECT、observer/setup与scheduler背景SQL；不把背景混成单请求，也不为单一查询制造全局instrument框架。SQL输出rows仅limit+1后最多21条完整chunk，需记录decoded field UTF8与JSON.stringify UTF8字节，明确非PG wire、非WAL、非总扫描payload。HTTP正文按实际接收UTF8字节，≤48KiB；query输入bytes/命中source/chunk/hasMore另报。server当前仍取完整chunk后制作excerpt，短HTTP不等于短PG返回。
- 同条件普通SELECT n=3仅报原样本/中位数/范围；HTTP每场景n=1仅报单次，均含连接/解码/观察开销；EXPLAIN时间不与HTTP拼接成“速度”。不估p95/SLO、CPU瓶颈、生产规模或agent容量。raw计划/语义/清理与摘要必须同target绑定；任何失败原样保留。

## 停止与清理界限（建议，入口审查后另开窗口）

建议一次总120s：≤70s含创建/迁移/seed/ANALYZE/查询，≤40s自有资源清理，≤10s最终回执；使用同起点绝对deadline，单条statement_timeout≤1500ms、lock_timeout≤500ms且不能越剩余work预算。任一金样本失败/SQL超时/连接身份未知/时间或字节门槛触发即停止后续；不自动重试、不强杀他人服务/连接。

只有自有随机DB创建ACK+identity已确认、app/pool正常close、自己的连接数0时普通DROP并确认absence；未知则HOLD、保留身份/原错误与待清理说明，不按名字猜可删。临时目录只按本次记录身份清理；free门槛与监督器由实际入口沿现有局部验证规范复用。完整DB最终逻辑sample≤128MiB、owned临时/evidence≤8MiB、单计划≤64KiB、合计raw≤2MiB（观察/输出上限，不伪称PG执行峰值硬quota）。本规划文档新增/修改总量≤128KiB，0实际DB留存变更。

## 后比较假设与进入条件

先由baseline定位成本，再考虑两个零扩展SQL候选：A只去掉强制物化/NOT MATERIALIZED；B把同project/current下的FTS与literal分支拆开，再按相同chunk身份去重并统一winner/sort/limit。A可能仍因OR/literal扫描不使用GIN，也可能重复计算；B可能FTS分支用索引却增加literal扫描/去重开销。必须先用完整金样本证明相同引用、rank排序和结果预算，不能提前下推分支limit损坏每source winner/全局top-k；同RR snapshot与project授权仍不可变。此处不改SQL、不承诺索引或提速。

pg_trgm/pgvector只作REQ-10后继方法参考，本段不安装、不建索引/向量/模型。pg_trgm支持部分LIKE/regex索引，短/无可提取trigram模式可能仍全索引扫描；不能将精确strpos随意改成通配LIKE。未来vector近似检索有filter后置/召回影响，授权与project/current必须作为独立验收，不能用本词法baseline关闭hybrid/vector要求。

## 方法来源与质量复核

本地发现沿Mika已完成结果复用，无Supabase本地安装；Mika先在skills.sh命中官方候选，14:55补试 `npx --no-install skills find 'supabase postgres'`（cwd /tmp）exit1，缓存缺skills@1.7.1且未给YES，未安装；此CLI查找未成功，不重试，固定raw内容已实际读取核来源。本次实际读取 `/Users/citrine/.agents/skills/find-skills/SKILL.md`、`codebase-design/SKILL.md`、`clean-code/SKILL.md`。clean-code固定来源sickn33/agentic-awesome-skills `bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5`。应用于单一诊断入口、领域语义与观察分离、错误/清理所有权，不造新调度器或benchmark框架。

远端已读官方supabase/agent-skills固定 `c9be0e931b7930f7d02126d04774d904c381e7d7`，skill版本1.1.1：
- [SKILL.md](https://raw.githubusercontent.com/supabase/agent-skills/c9be0e931b7930f7d02126d04774d904c381e7d7/skills/supabase-postgres-best-practices/SKILL.md)
- [monitor-explain-analyze](https://raw.githubusercontent.com/supabase/agent-skills/c9be0e931b7930f7d02126d04774d904c381e7d7/skills/supabase-postgres-best-practices/references/monitor-explain-analyze.md)
- [advanced-full-text-search](https://raw.githubusercontent.com/supabase/agent-skills/c9be0e931b7930f7d02126d04774d904c381e7d7/skills/supabase-postgres-best-practices/references/advanced-full-text-search.md)
- [query-index-types](https://raw.githubusercontent.com/supabase/agent-skills/c9be0e931b7930f7d02126d04774d904c381e7d7/skills/supabase-postgres-best-practices/references/query-index-types.md)

采纳实际plan/buffers/rows观察法；不采用示例中“Seq Scan必缺索引”“LIKE不能用索引”或10–100x/100x收益作为本项目事实。

官方交叉依据：[PG16 CTE materialization](https://www.postgresql.org/docs/16/queries-with.html#QUERIES-WITH-CTE-MATERIALIZATION)、[PG16 pg_trgm](https://www.postgresql.org/docs/16/pgtrgm.html)、[pgvector Filtering](https://github.com/pgvector/pgvector#filtering)（仅2026-10-07阅读时的方法参考，未选用版本/安装）。本段结论仅源码定位与未来有限诊断方案；工程/PG/性能检查全部NOT_RUN，独立文档review待Mika。
