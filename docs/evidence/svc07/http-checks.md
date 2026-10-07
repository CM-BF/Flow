# SVC07 唯一实际 HTTP 消费者窗口

2026-10-07，窗口 `SVC07-HTTP-RESOURCE-RECOVERED-20261007`。Lead授权且Web manager明确无活动重资源holder后，Mika交接一次运行。实际执行HEAD `1b3e16626c214f179640574dcd3ba93de10213ed`；准备审target `35f78c8b1edc67f1646b395dd62bc1cf389ebef9`；产品target `e28c4ed0a30ec2800eeca2ca5c444c0081c38165`。原233输入及manifest SHA256 `13349864e53abfb85b827e13545e6ffb9de5280ba6a242ee1e5f10f0d78bea06`未变。

精确入口（本worktree，安全source既有env后仅映射授权admin变量；未输出或落盘凭据）：

```text
/opt/homebrew/opt/python@3.13/bin/python3.13 -B docs/evidence/svc07/execute-http-once.py --expected-head 1b3e16626c214f179640574dcd3ba93de10213ed --manifest-sha256 13349864e53abfb85b827e13545e6ffb9de5280ba6a242ee1e5f10f0d78bea06
```

原入口fresh核HEAD clean、claim v1于02:11:50.753Z有效且身份/4scope吻合、233输入/18依赖一致、8输出absent；可用26,694,959,104B，满足原1,207,959,552B门槛及64MiB预留。实际只启动原显式单测试路径，没有重跑15fake、2断连、types或collect，没有provider调用。

**selected 1 / passed 1 / launcher exit 0 / child exit 0**。原封套从准入起计总wall **2.979205375071615s**；Vitest内部duration 2.37s是不同口径，不相加。实际19个HTTP请求、4组断言：并发相同command key合并、同库server重启后原ACK重放/变payload拒绝、两runner并发claim唯一assignment、取消历史及撤销runner授权。见[原始输出](http-output.log)、[fixture结果](http-result.json)和[封套回执](http-exit.json)。

Cleanup为CONFIRMED：CREATE已ACK；专库 `flow_svc07_http_863a38d11959` / OID `1187841` / marker `c7280a7e-18d9-4aaf-999a-299275883087` 经fixture身份核验后，在app已关闭及连接0时普通DROP，随后DB absence/admin.end均确认。两次动态listener `127.0.0.1:61829`、`:61838`均closed。以上DB/listener事实来自fixture观察回执，归档阶段未新连PG或扫描端口。

自有PID=PGID2952，02:11:50.773633Z启动；监督回执记录leader exit0、组absent、stdout EOF、0signals/secondary failures。raw observed=retained=413B，SHA256 `8779c5eccb692a7c2e1b4df1d00d5feba26bc5660fe215c471e4fda2a6b41f76`。TMP原dev16777234/inode123327452，同身份空目录删除，归档前再次lstat确认absent。7个原始输出保持独占0600，[完整长度/hash清单](http-output-manifest.json)；不覆盖历史HOLD或旧PG原件。

Mika已只读交叉核7raw/4935B、raw hash、233inputs与产品未变，并独立lstat确认tmp absent；本节为其当次消息事实，不提前声明待提交结果target已获最终独审。窗口已经Mika明确归还并通知Web manager；没有待launch/待清理资源，不开放C02或任何后继执行。

范围限制：此1旅程补充公开事务的必要真实HTTP直接消费者；不等于全HTTP回归、真实COMMIT丢ACK注入或main集成。旧15fake、2真实断连、监督6例分别保留其证据范围，不重复累计。旧监督PGID391的EPERM/UNKNOWN不因本次group absent而改写。固定准备文档中的NOT_RUN是历史时点，保持原字节；当前实际事实由本记录与唯一status承载。

本段clean-code复核沿本地find-skills、codebase-design、固定sickn33 clean-code@bdacd76：只归档已审Interface的实际结果，检查失败身份、一次资源关闭、输入和历史原件不变；没有新增模块、抽象、依赖或产品改动。后续仅固定结果独审及main接收。
