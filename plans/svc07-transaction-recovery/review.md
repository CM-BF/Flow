# SVC07 独立审查

状态：**APPROVED**，仅固定源码与受控 fake 范围；真实 PG/HTTP 和 main 集成未通过本审查证明。

| 字段 | 事实 |
| --- | --- |
| Reviewer / 时间 | Mika / gpt-6-astra；2026-10-06 约20:10 UTC（reviewer回执） |
| Base | 22a0806bc2465e11096949618113833f31766b19 |
| Source target | e28c4ed0a30ec2800eeca2ca5c444c0081c38165 |
| Worktree / branch | server-transaction-disconnect / codex/server-transaction-disconnect |
| 范围 | apps/server/src/database.ts, apps/server/src/database-transaction.test.ts |
| Source对照 | 两源WT=固定Git，SHA与green/types回执一致 |
| 检查复核 | red/green/types原始len/hash一致；15/15+types exit0；reviewer0重测 |
| Findings | 0 P1/P2；无阻断项（上述范围） |

## 审查方法与结论

对照固定 pg8.23.1/pg-pool3.14.0 核 callback 安装 listener 在 promise 恢复前、run只调用一次且未结算不提前release、COMMIT未知destroy不重放、ACK成功保留、ROLLBACK/release不盖先前失败（含null/undefined）、同步release交接只移自身listener。已先用本地 find-skills/codebase-design/clean-code 方法审视单一连接生命周期和错误所有者。

证据：[checks](../../docs/evidence/svc07/checks.md) / [source manifest](../../docs/evidence/svc07/source-manifest.json)。作者接受结论，无源码修复请求。设计审 architecture_read 19:44:42 的0 P1/P2为更早设计事实，不代替本次固定源码审查。

## 限制与后续

真实PostgreSQL借用期间断连、HTTP继续服务、直接消费者和main集成仍未执行。server.test.ts既有fixture硬锁flow_c01并DROP schema，不能未经隔离直接运行。后续在同claim证据内准备专库公共transaction探针，仅终止自己已核backend；精确源码/依赖/资源窗口另行准入，不停止共享PG，不扩scope、不改变已审源码。

后续若实现修改，必须绑定新commit复审；metadata不自动扩大本次approval。
