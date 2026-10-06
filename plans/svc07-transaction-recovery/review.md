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


## 后继PG验收packet（待审，不扩大上文approval）

- 准备source target：`edbe2e0a04b58fd95207904889cbc0e7e5666c53`。
- Manifest：`docs/evidence/svc07/pg-prepared-manifest.json`，19个固定路径，SHA256 `89a8ae8de72f1af0239e364cec6243b422accb0585a4203932c9232eee6f383b`。
- 源码：[pg-transaction.test.ts](../../docs/evidence/svc07/pg-transaction.test.ts)、[固定执行封套](../../docs/evidence/svc07/execute-pg-once.py)、[精确边界/命令](../../docs/evidence/svc07/pg-window.md)。
- 局部types v2 exit0；监督v3 6选6过仅自有process接缝；产品15fake证据保留且不重跑/累计。监督首红与两个明确UNKNOWN案例保留，不能由6过推断全部组消失。
- Mika已中间只读核v3与三态/即时spawn/主错误保留；正式approval仍PENDING，需绑定固定target。实际PG/HTTP/main仍NOT_RUN，不提前开窗。


## PG准备packet正式独审与实际结果分界

Mika / gpt-6-astra，2026-10-06 20:37UTC，绑定 `93dacd96dcbab935a4e9bde75de0ffdc5a550d09`，manifest `89a8ae8de72f1af0239e364cec6243b422accb0585a4203932c9232eee6f383b`：**APPROVED /0 P1/P2**。19文件334857B均Git=WT且len/hash相符；五未来输出在审查时不存在。范围仅准备包/静态源码/raw复核，监督6过不推断全部children gone，PGID391 UNKNOWN/EPERM保留。此条取代上文packet待审状态，产品e28原approval不变。

Lead窗口后owner执行一次，真实PG2/2及cleanup CONFIRMED，见[实际结果](../../docs/evidence/svc07/pg-checks.md)。实际结果为owner新证据，未借准备approval声称已完成结果独审；HTTP消费者/main仍未集成/未验证。


## 真实PG结果忠实性独审

Mika / gpt-6-astra，2026-10-06 20:44:52UTC，target `05a3e901f4abf6f11cb7067cfca6167589a1cf9b`，**APPROVED /0 P1/P2**。范围为公开transaction两类真实断连、同pool恢复、输出忠实性与已观察cleanup。4原始输出4464B逐Git=WT、len/SHA/0600/regular全部一致；reviewer独立lstat确认pg-tmp不存在；产品相对e28无变。raw537B/hash67ff4bbb3a6dbce4d244dafc3d8862ddf19edf1a6d9c5d6c616cfd6a7ff93652。

2选2过/exit0/0.773694s；2次guarded terminate、回调各1次、旧写不存在、新事务commit确认。专库absence与backend清理由fixture回执支持，reviewer未新连接数据库；PGID absent/EOF由外层记录支持，未新扫描。旧监督PGID391 EPERM仍UNKNOWN；真实COMMIT丢ACK未注入；HTTP消费者和main仍未验证，已交Execution Lead在集成点以隔离专库完成原有并发claim/command replay+restart断言。此review不扩大为完整SVC07/HTTP/main通过。

## HTTP准备包独立审查

Mika / gpt-6-astra，2026-10-06 21:05:11UTC，固定target `35f78c8b1edc67f1646b395dd62bc1cf389ebef9` / manifest `13349864e53abfb85b827e13545e6ffb9de5280ba6a242ee1e5f10f0d78bea06`，**APPROVED /0 P1/P2**。233文件1394168B逐Git(commit)=WT且bytes/hash一致；18依赖realpath/packagehash一致，8实际输出absent，产品e28两源不变。已核createServer固定闭包/30 SQL、source身份、claim+disk准入、wx输出、同库两个server生命周期、DB OID+marker+零连接普通DROP、primary失败保真及未知、shared supervisor预算、types/import证据范围。此审只批准准备包，不代表实际HTTP/main通过。

随后owner一次入口在准入HOLD，未打开attempt；[记录](../../docs/evidence/svc07/http-hold-20261006-2108.json)。无fixture/封套/manifest修改，未自动重跑。
