# SVC07 唯一实际PG窗口

2026-10-06 20:44:15 UTC归档。已审packet `93dacd96dcbab935a4e9bde75de0ffdc5a550d09` / manifest `89a8ae8de72f1af0239e364cec6243b422accb0585a4203932c9232eee6f383b`，产品 `e28c4ed0a30ec2800eeca2ca5c444c0081c38165`。Mika于20:37UTC完成packet独立只读approval/0P1P2；Lead随后交接独占短窗口，owner执行且已归还Web/Lead，0待launch。

精确命令（SVC07 worktree）：

```text
/opt/homebrew/opt/python@3.13/bin/python3.13 -B docs/evidence/svc07/execute-pg-once.py --expected-head 93dacd96dcbab935a4e9bde75de0ffdc5a550d09 --manifest-sha256 89a8ae8de72f1af0239e364cec6243b422accb0585a4203932c9232eee6f383b
```

仅本次进程使用Lead既有安全env映射授权admin变量；无凭据写入/输出。封套fresh门禁：claim v1在20:43:05.466Z有效，固定HEAD clean/19源hash/五output不存在/依赖实路径匹配，available1,258,450,944B，预留64MiB后满足底线。

20:43:05.483720至20:43:06.094669UTC，**2 selected /2 passed /exit0**，从启动含准入总wall **0.773694s**；Vitest内部313ms仅子过程口径。借出idle与active query各一次guarded terminate，task回调各1次、旧事务写不存在；同pool新backend事务提交成功。subject PID/backend_start与后继身份见[结果](pg-result.json)。每次终止完整核自己的专DB、application_name、owner、pid与backend_start，0重试/共享服务停启。

Cleanup CONFIRMED：subject.end ACK、专DB连接0、普通DROP后数据库不存在、admin.end ACK；自有PGID31256确认absent，leader exit0、stdout EOF、完整537B，0signals/secondary failures；tmp身份一致且空后移除。输出独占0600、raw SHA256 `67ff4bbb3a6dbce4d244dafc3d8862ddf19edf1a6d9c5d6c616cfd6a7ff93652`，[完整回执](pg-exit.json)/[原始输出](pg-output.log)/[长度hash清单](pg-output-manifest.json)。

证据不累加：产品fake15/15及types、probe types、监督6例与本次真实PG2例分别证明不同内容；此次0重跑产品fake/监督。旧监督fixture的UNKNOWN/EPERM不因本次组退出而改写。准备文档/manifest中NOT_RUN是原先固定准备时事实，保持不改；当前实际结果以本记录和唯一status为准。

仍未执行HTTP/commands/claim直接消费者与main集成；既有flow_c01固定DROP fixture不能直接共用。真实COMMIT丢ACK未在本窗口注入，fake限定语义仍适用；不归因历史个人服务问题。段末clean-code复核：未改固定实现或封套，只归档完整结果，原失败/未知历史保留，无新抽象/依赖/运行。
