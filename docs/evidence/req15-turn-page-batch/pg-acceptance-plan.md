# REQ15 最小真实读取验收准备

状态：DESIGN_PACKET_NOT_EXECUTABLE / PG_NOT_OPEN。这份计划与固定供给清单供下一轮审查；尚未创建/运行fixture或执行封套，没有可执行入口获批。产品冻结在d209eb7275777d50f214fd73f66d6b3c1520c459（6源相对已审3cd不变），不得为fixture改产品、contracts、migration或context写路径。SVC07真实HTTP优先，不预约或抢窗口。

## 最小输入与真实复用

使用本worktree已供给的90路径与已审读模块：database.migrate/transaction、queries.turnPage、state.turnView/turnViews、assistant.readAssistantFinalPreviews。已有9依赖足够（pg8.23.1、Vitest4.0.18、Node24、同树@flow/contracts），不引新包或跨树产品。

数据库仅应用原始schema的本次读取闭包：database.migrate创建inline1并加载002，然后在专库事务内一次加载固定007/009/025并记录版本。002、009已在本树且byte=base；[精确请求](pg-provision-request.json)只缺007-conversations.sql和025-native-harness-sources.sql，2文件2681B，均base22a的blob/bytes/SHA。Lead sole供给，owner不自行物化。

选择部分原始migration是为真实执行当前读取SQL，不代表全产品bootstrap。基础conversation字段足够分页；本轮不插入conversation_input_id，也不声称验证context/附件或032消息配置写约束。冻结context/settings已经有fake读取检查，真实约束和对应HTTP消费者留给完整迁移的集成点。不会复制或手造替代生产表结构。

## 有界验收片段

拟新增本evidence内 `pg-turn-page.test.ts` 与 `pg-vitest.config.mjs`（显式此一个入口，2个顺序case），`pg-input.json`、`execute-pg-once.py`（本片薄封套，复用已审supervise方法）和固定input/output manifest。供给后先固定源码与types/collect证据供审；入口必须guard beforeAll，模块顶层不可连接PG，计划批准不等于执行批准。

| Case | 真实操作与独立断言 |
| --- | --- |
| PG1：批量读取/绑定/测量 | 独立专库seed 51轮混合typed、legacy、missing、pending、duplicate-session、duplicate-artifact及错误身份；通过真实turnPage验证顺序、50+1/nextCursor/第二页/空页/crossconversation/404。期望按seed数据显式列出状态和文本，不以新turnView作为唯一oracle。独立paired请求(taskA,attemptB)/(taskB,attemptA)均missing，正确配对健康项仍正常。保留多个task各自1或2详情，证明LATERAL/JSONB的LIMIT2逐task生效。 |
| PG1：全文内容/身份补充 | 插入内容a×4000+OLD与对应full digest，然后将实际存储内容改为相同4000前缀+NEW，确认DB左前缀相同而全文digest不同；public batch该项返回assistant_content_mismatch、其它项健康。覆盖错current attempt所属task、owner_version、session harness/runner、匹配合法messageId但native session不对应；typed invalid不得fallback legacy。Unicode内容使用汉字/emoji/combining边界，独立JS计算full UTF8 hash和UTF16前4000裁切期望。 |
| PG2：同client RR并发快照 | subject max1借出真实client，turnPage已读取task rows后仅用fixture query观察接缝暂缓返回该真实结果；writer max1在另一真实事务同时提交task title与final body/digest更新，再放行subject。旧page必须是旧title+旧reply，下一独立page是新title+新reply。记录barrier恰触发1次和writer COMMIT ACK；不靠sleep猜顺序，不替换SQL结果或产品transaction。查询返回错误/超时保原值，未settle的操作不提前release复用。 |

每个case混合多项独立断言，不拆几十次服务启动。seed上限60tasks/60attempts/62sessions（含foreign）、120details+60assistant records+20artifacts；正文总UTF8≤4MiB，单正文≤64KiB，只记录统计和digest不把正文打到stdout。准备实现时若实际最小seed超此数须先改受审input，不无声放宽。

## 性能测量口径

先记录真实SQL调用/完成次数，测量段严格只包公开turnPage调用，seed、identity、BEGIN控制之外的诊断分开。拟在fixture为subject pg连接添加只读DataRow/ReadyForQuery观察者，依据固定pg8.23.1/现成pg-protocol实际事件源复核后使用；不改变结果、不注入cache或替换driver。每个测量段记录SQL调用数、ReadyForQuery完成数、行数、字段原始UTF8载荷byteLength、返回page的JSON UTF8 byteLength和wall。该窄观察接缝必须在可执行源码审查中固定，若事件不可靠则拒绝输出该量，不能用猜测填数。

DataRow字段载荷是PG发送的text值UTF8字节（JSONB值使用解析前字段文本），null计0；不包含4-byte长度、消息头、TCP/TLS开销，不能称完整网络字节。public page JSON字节与DB载荷分开；HTTP实际body字节在集成点独立测。预期typed/mixed页面真实调用有≤9上界，但以实测为准；不把旧fake214或历史252当当前PG基线，不从低往返数推断TOAST/hashCPU减少。legacy body仍全文传JS，需单独统计该类content bytes；typed仍在PG全文hash，仅prefix过连接。

## 生命周期、预算与未知

拟整体30s（工作20s、清理7s、外层监督27s+最多1s自有组终止观察）；固定新DB名称/随机marker在input阶段生成，admin/subject/writer分别固定application_name。最多3连接，无pg-boss/server/provider/HTTP/native。数据库64MiB预留，实际fresh PG floor1207959552B及剩余1GiB条件不降低；源码/types/collect轻检查另按1107296256B。合并raw≤64KiB，聚合结果≤32KiB，独立TMP前后采样≤32MiB/同inode清理，说明非实时硬隔离。

复用已审生命周期方法：fresh branch/head/claim/source/deps/输出全absent；wx0600 reservation、DB OID+marker和立即own PID/PGID；deadline/query/connect timeout；原始失败含非Error保留，cleanup仅secondary。关闭subject/writer的原操作得到ACK后，admin确认DB identity+连接0，再次核OID+marker才普通DROP并确认absence，最后admin.end；不terminate、FORCE、停共享PG或重试业务。关闭/身份/组观察不确定则UNKNOWN并保留专用身份，绝不扩大权限清理。supervisor借用方式与REQ15现有run-check一致，固定SHA、只注入cwd，不调用SVC主入口或改其文件。

## HTTP必要直接消费者（集成点）

当前base路由证据：apps/server/src/conversations/index.ts的GET `/api/conversations/:id/turns`解析conversationTurnQuerySchema后调用turnPage。无需为本性能片供给完整createServer闭包或另建HTTP框架。由Lead在包含已审REQ15的实际集成commit、完整migration的新专库/动态port环境中运行一个最小旅程：owner鉴权、51轮首/次页与空页、limit非法400、foreign conversation隔离/不存在404、typed/legacy/invalid及冻结context/settings投影；读取响应body真实UTF8长度并记录集成source。请求次数≤8，0provider。具体fixture由现有集成消费者入口复用，在Lead明确scope与供给后准备，不能将本直接SQL两例称为HTTP通过。

## 审查与完成条件

本packet只请求两份SQL及设计审。收到供给后再写最小fixture/封套，types/collect均显式本路径，固定执行manifest/commit交独审；实际PG窗口仍需新的明确交接。真实PG通过后输出/资源闭包需忠实性review，HTTP与main事实独立。后继若迁移子集不足，只回报精确新增固定文件，不复制missing表或绕过约束。

2026-10-06 21:49:49 UTC技能安全点：find-skills本地方法匹配Node/TS/PG，沿固定clean-code与codebase-design；将产品读取、测试观察、数据库所有权和进程监督职责区分，复用既有小接口/生命周期，不扩成性能框架或第二状态权威。0安装/import/tests/PG/HTTP。
