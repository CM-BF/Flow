# SVC07 HTTP消费者一次执行准备

状态：PREPARED_NOT_RUN；实际HTTP未开窗。产品仍是e28c4ed0a30ec2800eeca2ca5c444c0081c38165。新执行包须由Mika绑定最终packet commit与manifest SHA独审后，在Lead明确交接的独占窗口执行一次；fresh失败HOLD/NOT_RUN，实际失败/未知不自动重试。

## 验收边界

`http-consumer.test.ts`只注册1条真实HTTP旅程：相同command key并发提交合并、同专库server restart后原结果重放及变payload拒绝、两runner并发claim恰有一个assignment、取消历史/队列取消与撤销runner授权。使用本树createServer与动态127.0.0.1端口；不导入旧flow_c01 fixture，不停服务，不重跑15fake或2断连。未来pass仅证明这条直接消费者，不宣称注入真实COMMIT ACK丢失、全HTTP回归或已集成main。

## 输入闭包与模块责任

| 模块 | Interface与状态所有者 | 边界 |
| --- | --- | --- |
| 产品transaction | 原Pool/run/readOnly接口，产品e28 | 生命周期已有独审与15fake+2真实断连，保持不变 |
| HTTP fixture | 受OPEN/授权URL/绝对deadline约束；输出结果和资源身份 | 只拥有固定新DB、两次本地动态listener；业务断言与cleanup失败分开 |
| execute-http-once.py | fixed HEAD/manifest准入；最多一次Node child | 复用execute-pg-once.py的已审supervise，无新通用调度器 |
| 既有createServer闭包 | 固定22a的216文件（database.ts为e28） | 30外部SQL及内联migration、同树@flow；不把静态import等同全部运行路径 |

[请求](http-provision-request.json)枚举每个固定blob/bytes/hash、动态SQL和依赖入口；[Lead回执](http-provision-receipt.json)证明补209文件869209B和13链接，既有7输入未改。18总依赖均使用现成donor，@flow均解析到本worktree；0安装。完整执行manifest覆盖现有闭包实际字节、输入、封套/共享监督、配置及准备证据，执行时逐个核hash。

## 一次入口

从本worktree执行。最终固定40hex HEAD及manifest SHA由本packet提交后的交接提供；二者必须与正式review相同，不以当前main或通配ref替代。

```sh
source /tmp/flow-coordination.env
export FLOW_SVC07_TEST_ADMIN="$FLOW_COORDINATION_DATABASE_URL"
/opt/homebrew/opt/python@3.13/bin/python3.13 -B docs/evidence/svc07/execute-http-once.py --expected-head <固定packet-commit> --manifest-sha256 <固定manifest-sha256>
```

不要输出URL/令牌；实际脚本只输出状态、wall、receipt路径。子命令固定Node24/Vitest4.0.18显式单路径、runner config、no-cache、verbose、no-color。实际PG floor为1207959552B，另预留67108864B、剩余至少1073741824B；fresh claim须为SVC07 v1及全部4literal。准入核8输出全部absent、依赖realpath与package SHA、clean HEAD、manifest；不会修复或覆盖。

## 资源、截止与保真

整体60s，从外层preflight开始计时；绝对工作截止40s、清理截止55s，child监督57s到期后仅对已确认present的自有组TERM/最多一次KILL，各0.5s。复用监督器立即记录spawn PID/PGID/时刻，present/absent/unknown三态，EPERM unknown不升级信号；EOF、leader exit、group absent分别记录。父层结束超过60s明确UNKNOWN。preflight使用有界命令，未打开attempt时HOLD不创建资源。

固定独立DB `flow_svc07_http_863a38d11959`，marker/OID在[输入](http-input.json)和wx0600身份回执绑定。最大2tasks/2runners、24HTTP请求、每响应64KiB、合计stdout/stderr64KiB，server8+scheduler3+admin1最多12连接；工作关闭后再重启第二个server。tmp700绑定dev/inode，只清理本次空目录。日志/结果/身份均wx0600，不覆盖旧文件；持久reservation、数据库与listener身份单独留存。

首次业务失败保持原值；afterAll记录secondary失败而不覆盖，清理单独失败仍失败。startup/close使用原promise，未知时不重试关闭。只有CREATE ACK、OID+marker匹配、app已关闭、连接0并再次核身份才普通DROP；不用FORCE/terminate。随后核DB absence与admin.end。未知时保留本次资源身份，不自动重跑、DROP或扫描猜PID；由Lead按记录执行只读核对后另行协调。

8个实际输出：`http-run-reservation.json`、`http-database.json`、`http-server-1.json`、`http-server-2.json`、`http-result.json`、`http-output.log`、`http-exit.json`、`http-tmp`。这些当前均absent。收集证据使用独立`http-import.*`，不消费真实执行输入。

## 已完成的非运行证据

- `http-types.json/log`首错exit2保留；`http-types-v2.json/log`修正参数类型后exit0，wall1.935556s；仅局部types，0PG/HTTP。
- `http-import.json/log`为Mika20:59UTC静态批准的一次Vitest list：collected1、exit0、wall1.549670s、257B raw、group absent/EOF完整、tmp absent。COLLECTED_NOT_EXECUTED，testPasses=null，0PG/HTTP。
- 当前包复用旧15fake和监督6的各自范围，不累计重复通过，不把类型/收集当1pass。旧PGID391 EPERM仍UNKNOWN。

## 技能与质量安全点

2026-10-06 21:04:07 UTC：沿本地find-skills，Node/TS/Postgres任务选已固定clean-code（sickn33/agentic-awesome-skills@bdacd76）与codebase-design；不联网重装。核命名、单一责任、状态所有权、错误身份、一次资源关闭、依赖方向和有界输出。保留fixture业务层、执行准入层与既有监督接缝；未复制监督框架、未改产品接口。首次类型错误已修；实际HTTP与封套独审仍待完成。新扩展仅修改本fixture旅程/显式预算，不向产品引入测试控制或第二状态源。
