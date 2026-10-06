# B02 turnPage 读取成本基线

固定实验 target：`38b2353dade0431dded067f20711ddc79b4c7430`；产品源码基线 `75a33dec228e17bbbd0d3be9fd01bc9ac18a0133`。本轮只有实验，产品源码零变化。

公开 HTTP `GET /api/conversations/:id/turns?limit=N` 的正常 typed 路径，每页实测 `2 + 5 × turns` 个 SELECT。50 turn 长回复页读取的 decoded rows JSON 为 6,655,040 B，HTTP 正文为 454,512 B；正文 SHA256 输入 6,553,600 B。固定查询数不能说明大正文成本已经有界到预览大小：读取全正文并验证 digest 后，产品才截取前4000 UTF-16 code units，避免末尾半个代理对。这不是4000 UTF8字节上限。

| turn数 | 单回复 UTF8 B | SELECT + 事务语句 | PG解码 rows JSON UTF8 B | HTTP正文 UTF8 B | 正文SHA输入 B | 首请求 ms | 后续 p50 / p95 / p99 ms | 正文SHA compute p50 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 256 | 7 + 2 | 2,581 | 2,460 | 256 | 7.51 | 3.79 / 4.56 / 5.05 | 0.003 |
| 20 | 256 | 102 + 2 | 45,849 | 43,132 | 5,120 | 20.92 | 18.44 / 20.36 / 20.83 | 0.037 |
| 50 | 256 | 252 + 2 | 114,197 | 107,362 | 12,800 | 36.93 | 61.41 / 138.11 / 143.49 | 0.154 |
| 1 | 131,072 | 7 + 2 | 133,398 | 9,403 | 131,072 | 4.29 | 4.49 / 4.99 / 4.99 | 0.213 |
| 20 | 131,072 | 102 + 2 | 2,662,177 | 181,992 | 2,621,440 | 40.91 | 41.73 / 45.36 / 47.12 | 4.200 |
| 50 | 131,072 | 252 + 2 | 6,655,040 | 454,512 | 6,553,600 | 97.82 | 120.56 / 236.67 / 248.00 | 10.946 |

每组首请求单列，后续 n=20，分位采用 nearest-rank（p99为最大样本）。首请求发生在SQL播种之后，不是PG/OS冷缓存；未做清缓存或重启机器。六组固定次序（短1/20/50再长1/20/50），共享主机、测量钩子及后台任务影响耗时，不能据此推稳定tail、SLO、优化倍数或agent执行容量。首轮即成功，不额外重复性能run。

## 测量方法与边界

- 实际中心/PG/API；SQL合成持久task/attempt/session/assistant-final/turn，contract解析typed数据，所有prompt/metadata固定。两种正文为256 B与131072 B，含中文/emoji；无模型、云或用户文件。共有142个矩阵turn，加两个guard turn；typed正文合计9,324,328 B（矩阵9,324,288 B，guards40 B）。
- 包装同进程 `pg.Client.query`，用HTTP hook的 AsyncLocalStorage 归属区分本请求与后台。保留原callback/Promise结果和错误；日志仅归一化SQL模板（前240字符），不记录参数或内容。每请求原始query分类/count/rows/bytes/elapsed及后台分类都在 [results.json](results.json)。BEGIN repeatable-read read-only/COMMIT分别计数；SELECT统计不含事务，后台不是页面的SQL。
- 数据库字节**是`Buffer.byteLength(JSON.stringify(result.rows))`的UTF8**，含字段名/JSON转义/数组包装；既不是PG socket wire，也不是内存峰值。空事务rows为`[]`另计2 B。已解码JSON测量本身会增加序列化开销。
- HTTP字节为fetch收到的UTF8响应正文，不含headers；本次无正文压缩设置。源码在真实事务中读取，未对产品返回做替换。
- 临时包装SHA256 update/digest统计实际输入与compute时间，按已知正文长度区分正文hash与auth hash，不采集内容。compute不含输入字节计数/PG解码/JSON传输/preview构造，不是整个请求CPU时间，也不是移除校验可获得的净收益。每页正文hash数必须等于turn数、输入字节等于turn数×单正文UTF8字节。
- 6组×21=126个测量HTTP请求；每个均断言200、turn数、available与digest、实测SELECT数及正文hash数。每组6项查询/字节/hash字段在21样本内完全一致。7项额外语义检查见下文。未使用Vitest；这是执行有断言的实验脚本，不将0测试算通过。
- 40条后台SQL在测量窗口内起始，单列 `backgroundSql`；不含启动/播种/窗口外后台。背景查询按起始时归属，完成后可回填该样本。主机其他进程负载未测，不称完全空闲主机。
- 固定本WT源码；依赖复用已安装包，不改lock。`@flow/contracts`指向本WT，migrations从本WT相对文件读取，详情见 [dependency-resolution.json](dependency-resolution.json)。包装在finally恢复，server/pool关闭后只等待自有DB连接0并正常DROP。

## 语义与资源结果

7项通过：未提交typed final仍pending；typed final提交后但task未success仍pending；success才显示绑定正文；损坏正文digest拒绝；foreign native session绑定拒绝；跨conversation detail404；current attempt切换后不复用旧attempt final。这证明该读取序列及success门禁，不外推完整PG isolation或并发晚提交矩阵。guard使用真实PG事务/公开HTTP读取，task终态和身份破坏由受控SQL夹具注入，**不是runner执行端到端验收**。

实际实验UTC：2026-10-06T04:48:13.016Z → 04:48:20.758Z，7.742秒；外层命令04:48:12.850Z → 04:48:20.775Z，exit0。[baseline-command.json](baseline-command.json) 保留完整命令/exit/time，[baseline.log](baseline.log) 保留stdout。工作截止90s，外层120s超时保护；本轮未触发。唯一DB `flow_b02_71695_dd2aa05b` 已普通DROP，remaining=[]；动态端口见results。未触他人服务。

类型检查：显式本实验tsconfig `--noEmit`，04:47:49.837Z → 04:47:50.760Z exit0，源码与target一致，见 [typecheck-result.json](typecheck-result.json)。首次继承根exclude导致TS18003/0输入，二次hash包装this缺类型TS2683，均exit2；原 [首次](typecheck-initial.log)/[二次](typecheck-second.log) 保留，修正后通过。额外只读依赖核验曾猜测不存在的`@flow/storage`而MODULE_NOT_FOUND；该包不在server依赖，修正为核实相对migration路径；未影响成功baseline或其结果。

## 有证据的局部候选（未实施）

1. **先消除每turn串行往返**：在同一repeatable-read只读事务内，给turnPage增加只覆盖当前有界页的批量task/session/session-detail/assistant-row/body读取接口，保留每行task/current-attempt/owner/native-session/source/digest检查及现有有效性映射。候选范围 `apps/server/src/conversations/queries.ts`、`state.ts`、`replies.ts` 和 `apps/server/src/assistant/store.ts`（必要时其index薄导出）及直接消费者测试，须重新协调owner/claim。目标是减少实测252 SELECT，并非已经证明耗时改善；批量读取仍有相同全文字节和hash工作。
2. **全文字节问题单独决策**：50长回复页的正文SELECT解码JSON本身6,554,400 B，占本页总解码JSON约98.49%。在当前“随读发现详情正文被破坏”的语义下，仅SQL截preview或缓存digest都不能代替全文校验。本轮明确不删digest、不创建无界cache；若后续设计持久preview/完整性凭据，需先定义所有正文写入口/不可变性/历史损坏处理，并独立授权迁移和writer范围。本次证据不批准该架构变更。

session详情此矩阵每turn都是固定小的v2身份JSON，50turn对应该SELECT共12,550 B，未做超长session元数据压力矩阵。页面和未打开详情的API消费者成本由本实验覆盖，真实UI/渲染、生产负载、模型token均未测。没有模型token节省结论。
