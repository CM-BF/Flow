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

## 2026-10-07 HTTP实际结果（待固定target忠实性独审）

Lead新窗口由Mika在Web manager无活动holder确认后明确交接；原入口在执行HEAD `1b3e16626c214f179640574dcd3ba93de10213ed`运行一次。selected1/pass1、exit0、wall2.979205375s、19HTTP/4断言；[checks](../../docs/evidence/svc07/http-checks.md)与[原始输出清单](../../docs/evidence/svc07/http-output-manifest.json)记录事实与限定范围。

Mika已在本次消息只读核7raw/4935B均regular0600、raw413B/hash、233输入/产品未变和实际TMP不存在；fixture记录专库/两listener关闭、连接0、DB absence及admin.end，外层记录PGID2952 absent/EOF完整。此为归档前交叉核对，不把待提交结果target写成已批准。窗口已明确归还；下一步绑定结果commit独审，仅核忠实性与新证据，不重跑旧检查。

本次不注入真实COMMIT丢ACK，不证明全HTTP回归或main接收；旧HOLD/监督PGID391 UNKNOWN保留。原产品e28、PG05a3、HTTP准备35f的批准范围均不改写。

## HTTP实际结果最终忠实性独审

Mika / gpt-6-astra，2026-10-07 02:14–02:15 UTC，固定target `3a94a629c28a44e9f7dc6369ecd5cf947a30f80c`，**APPROVED /0 P1/P2**。本条取代前一节等待固定结果独审的状态，仅批准真实HTTP结果忠实性与已观察cleanup；不扩大为main集成。

7raw共4935B逐Git(target)=WT、bytes/SHA/regular0600一致；输出manifest SHA256 `fedeba9427c46abb84e99944bed83600bac80cd48abd6a2712e60d2e86e8d409` Git=WT；233输入、原manifest及e28两产品源未变。1选1过、launcher/child exit0、wall2.979205s、19HTTP/4断言与原始日志和回执吻合。完整EOF、PGID2952 absent由外层记录支持；DB零连接、身份核验后普通DROP/absence/adminClosed及两listener closed由fixture观察支持，reviewer未新连PG或扫描进程；TMP独立lstat absent。

结果delta的 `git diff --check` exit2仅 `http-output.log:10` 为原始Vitest EOF空行，按raw保真保留，不改日志以消除告警。旧HOLD、PGID391 UNKNOWN及未注入真实COMMIT ACK loss的限制完整保留；output manifest原PENDING_FIXED_RESULT_COMMIT字段保留其封存时点，最终批准由此metadata绑定记录。

Owner接受结论，无源码或原件修复。当前仅status/review归档；本片段进入integration，main接收与架构同步交Execution Lead。claim v1保留、停止写入，不因归档重复运行或预约资源。
