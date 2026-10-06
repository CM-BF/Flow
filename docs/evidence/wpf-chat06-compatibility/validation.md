# C01 验证

固定实现 `8c56211739ae0c20816c67caad13cee510130514` / base `a26a5f34577d3fdfeee81ef8c0e7d5658617d2b8`。受控shared input仅86fc→3363，[before/after](input-provenance.json)一致；不把未实装协商当本片通过。

- [原red](red-direct.log)：projection77，其中14失败/63通过，315ms。失败真实命中旧literalfalse拒missing/true，未删除断言。
- [green](green-direct.log)：2026-10-05 23:48:47 PDT，projection77 + outbox11 + queue16 =104/104，Vitest4.0.18，931ms。
- [Webtypecheck](typecheck.log)：`pnpm --filter @flow/web typecheck` exit0，Node24.20.0/pnpm9.15.4。
- [checks](checks.json)及[2源绑定](source-binding.json)：检查后、提交前捕获b76+dirty HEAD与hash，源在green后未再变动，逐个与target和当前字节吻合；不事后伪改成实现或metadata HEAD运行。
- 实现diffcheck0。根manifest/lock/Web依赖无diff；App/Thread/queue/outbox实现及client未改。共享唯一diff是已授权optionalboolean合同。

新矩阵经mock fetch `Response`和真实FlowClient，不是HTTP server/真实中心。GET/CREATE：缺失归false、false与true保留；与queuefalse/true交叉；null/string/number/object拒。坏GET不替换已知态；坏CREATE保持unknown、0turn，原key/payload重试；true不绕过conversation/turn/task/project/profile身份。GET不自动发送消息，CREATE最多一次普通follow-up；没有stream/detail/nativeactivity请求或协商header。既有final回执重放、historygap、离线unknown与queue回归随三个直接路径保留。

没有UI变化，未做browser/build/截图/新预览；没有provider、DB、模型、流正文、协商header或实际新center验收。后继协议规定CREATE永久false（同key replay不改原receipt）、GET显式header且center/产品门槛满足才true；本片仅兼容reader。旧49922/55049/63743等服务和用户tab保持。

## 原始日志与独立复核

实现diffcheck0；完整base→metadata diffcheck只命中原始日志：green-direct.log:12末空行；red-direct.log:153/156/237/240/257/260尾空格及278末空行；typecheck.log:4末空行。保留原日志，不清洗或说成全量diffcheck0。

root独立APPROVED固定8c56211739ae0c20816c67caad13cee510130514。2026-10-06T06:53:27Z独立三路径104/104，544ms；两个source hash、受控合同hash和当前scoped diff核实。作者Webtypecheck为阅读原日志，不是root重跑；无新增browser/HTTPserver/DB/model。详细范围见[review](../../../plans/wpf-chat06-compatibility/review.md)。
