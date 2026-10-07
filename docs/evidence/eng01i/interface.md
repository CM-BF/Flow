# ENG01I Interface

这是既有G/F/A调用路径的有界组合，设计已获Execution Lead授权。四产品文件；无新authority/setup/launch注册或配置入口。

`createNativeEngineeringAdapter({ project, configuration, reference, authority })`接受host私有SyntheticProject、有限v2配置、已发布immutable profile reference和NativeWriteAuthority实例。构造时复制/解析配置与pin、核配置hash和project identity；缺authority拒绝，JSON字符串不授权。每assignment从真实context.executionIdentity核task/runner与intent/profile/checker/base。task不提供目录/args/可信checker。输出既有HarnessAdapter，name codex / engineering-codex-1。

每run只acquire一次。私有decorator观察原authority的真实open/close调用，复制同binding的revoked结果；不能从普通final、childexit、取消或调用者JSON制造停止。调用G的createCodexEngineeringWriter和executeEngineeringWriter，不接受可替换任意writer，也不复制其pump。只有G返回stopped/completed、同authority撤销事实和当下ownership同时满足才调用F capture；stopped/failed走既有settled failure，不发布通过收据。

F仍独占完整snapshot前后、固定路径读取与pure checker；本片只让其receipt消费A公共wire schema，旧合法JSON顺序/检查重算保持。既有writerSettlement:not-attested保持，不被改写成native stop。完整capture recorded后，adapter用真实identity/lease/profile/qualification引用与观察到的撤销事实构造A native receipt；emit artifact→verification，terminal仍由runtime独占。

一旦可能启动writer，默认保守持有workspace。writer未知、撤销未知/错binding、ownership/abort、capture未知、任一emit拒绝/丢ACK或发布后ownership丢失均抛既有NativeExecutionError unknown并保留lease。只有确认停止且整个发布成功（或可信原生已停止的失败）才释放；若release自身失败亦unknown。未知不能输出passed/completed，恢复复用原journal/admission/outbox，adapter无新重投循环。私有per-assignment去重拒绝同assignment再次启动，project持久active lease阻止新进程重新acquire；不靠内存去重声称跨进程完整恢复。

性能沿G open/ownership窗口及独立close窗口各<=60s；F源<=2KiB、全文件/目录/bytes既有限额，A收据<=512KiB。无模型/通用权限registry/动态脚本。注入authority只证明模块调用、失败组合与真实文件/PG收据，不证明OS隔离或模型身份。

验证：保留F固定输入旧JSON/hash对照；F capture与G writer真实直接消费者定向组合；自有Node JSONL peer经原R06/G写合成Git，真实PG/runtime/outbox公开读回正确与失败检查；写入未知/撤销失败/abort/丢artifact ACK保留lease及重启0新writer。随机专库先记身份，动态端口，所有测试自有peer明确关闭后才能由测试额外知识清理保留lease。0provider，不重跑61/105。
