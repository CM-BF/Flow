# B01 task 轻量读取投影

有界现有行为修改，沿FLOW-001 REQ-15/17与full-plan-matrix 2026-10-06 08:21候选。Mika已明确授权当前两reader及其真实PG/HTTP检查；不新设确认门禁。按[根模块规则](../../../../AGENTS.md#modular-design)设计。

`task-read-projection.ts`提供静态`TASK_SUMMARY_COLUMNS`、flat `TaskSummaryRow`与`toTaskSummary(row)`：列为id、submission->>title/harness、status、verification_status、created_at、updated_at。类型沿TaskSummary字段，日期仍Date；只一个映射权威，既有tasks.summary(TaskRecord)将其明确已有字段传入formatter。没有部分row强转TaskRecord，没有通用查询builder/任意列/锁参数。

首两个真实消费者：tasks.list用静态列，原cursor解析、created_at/id倒序、limit+1和nextCursor不动；eventPage同一REPEATABLE READ READ ONLY事务选择summary列+cursor/pending_decision/usage，404原code/message、timeline查询、raw nextCursor/reset、legacy过滤不动。loadTask及FOR UPDATE、snapshot prompt、owner鉴权与轮询250ms单flight保持。第三assistant-stream reader只读，首片不为它多读JSON或扩大scope。

可检验影响：完整prompt不进入两reader的PG结果/Node JSON解码；正常eventPage2SELECT、reset1SELECT、list1SELECT，请求频率不改。私有fixture对实际公开domain Interface的PG结果rows记录JSON序列化UTF8字节/字段名/SQL调用数，不记录正文/参数；旧SELECT*基准和生产reader在静态seed上输出相等。它是应用解码结果字节，不是PG wire/磁盘/TOAST量，不宣称SLO/吞吐收益。

验证通过eventPage/list/snapshot及真实HTTP，主要代表样本是合法公共POST的15999 UTF-16字符、37331 UTF-8字节Unicode prompt；128KiB合成SQL样本明确绕过公共16000字符上限，只另列压力观察，不代表普通产品输入；不把附件/context正文塞进submission。分页含相同timestamp tie-break、末页和非法cursor；events含reset/空页/隐藏stream条目rawcursor/无新timeline的usage+decision+status；snapshot原文、HTTP401/runner403/404。写锁以既有loadTask(lock=true)双事务真实blocking证据检查，不改生产锁路径。只本模块与直接消费者局部strict，不能运行旧C01固定库DROP SCHEMA。

资源合同：单次测量≤32tasks，每prompt≤1MiB，解码样本累计+结果证据≤32MiB；≤60s包含自有PG/HTTP初始化和清理，不含TypeScript/Vitest编译。固定4个SQL task+至多1个公共POST，不补跑取更好数。45s停新增，15s清理预留；query/connection与请求有限超时，独有随机库/动态loopback；CREATE发送前记录requested，仅普通DROP自有精确库且已确认连接结束，未知保留identity并失败、无FORCE/kill/无限重试。功能red/green与独立计量分别归档，0provider/SDK Query/LAB02/个人服务。

PG16官方来源确认jsonb_object_field_text经PG_GETARG_JSONB_P到PG_DETOAST_DATUM，窄提取仍可能取出/解压JSONB；仅减应用侧字段与解码，后续是否加head-only第三reader另据证据决定。来源：[jsonfuncs.c](https://github.com/postgres/postgres/blob/REL_16_STABLE/src/backend/utils/adt/jsonfuncs.c)、[jsonb.h](https://github.com/postgres/postgres/blob/REL_16_STABLE/src/include/utils/jsonb.h)、[PG16 TOAST](https://www.postgresql.org/docs/16/storage-toast.html)。REL_16_STABLE是官方分支参考，不冒充安装二进制精确源码commit；实际PG版本在fixture读取归档。
