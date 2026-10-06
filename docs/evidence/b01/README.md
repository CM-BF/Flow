# B01 读取与传输测量

初轮基于 main `edee6b1c5d74c2ee46ec98bab2844579db6a00c4` 的未改产品代码。2026-10-06T03:35:16.082Z–03:35:31.477Z，Node24.20.0 / PostgreSQL16.13；15.395秒，23个命名行为检查，exit0，47,496,585响应UTF-8字节。0模型/0用户文件/0新云，临时DB和动态HTTP端口均清理。原始结果：[initial-results.json](initial-results.json)；失败记录：[validation-history.md](validation-history.md)；[可重复入口](../../../experiments/bounded-reads/README.md)。

这些结果来自真实center HTTP和真实PG，数据由SQL合成装载；另用真实runner HTTP检查输入上限。1/16/128是已存任务数量，不是agent执行容量。详情“展开前0请求、展开1请求”由API消费者计数验证，不是UI浏览器证据。

## 测得的有界行为

- snapshot / events 每页最多100条；events/workspace请求limit=101返回400。全部历史分页无重复/丢失，最多16,384单任务事件和16,512跨任务feed项。
- detail完整内容不进入snapshot/events/workspace；引用字段只有id/title。snapshot保留任务prompt，workspace不带任务prompt。显式请求detail返回完整中文UTF-8。
- 50事件批次接受，51拒绝；中文detail恰好1,048,576 bytes接受，多1 byte拒绝；请求总body超过2,097,152 bytes返回413。
- 4000个中文UTF-16 units的正文为12,000 UTF-8 bytes。50条合法大正文加1个detail引用的events响应为606,650 bytes。条数限制不是小型响应的保证；当前没有更低的单页响应byte budget。

## 初轮本机耗时

各单元格为预热样本 n=50 的 p50 / p95 / p99（ms，nearest rank）；p99即最大样本，不能解释为稳定尾延迟。每个端点的首次请求单列原始JSON；PG/OS缓存未清空，没有物理冷缓存结论。初轮loadavg 13.67/10.79/9.27，背景负载较高且与Web队窗口尚待核对，绝对时延不可当SLO。

| 合成任务×每任务事件 | snapshot | events首100条 | workspace追平后的空页 |
| --- | --- | --- | --- |
| 1×128 | 3.23 / 4.49 / 5.04 | 3.19 / 5.39 / 6.22 | 4.44 / 5.32 / 5.48 |
| 16×128 | 3.21 / 3.70 / 4.32 | 3.01 / 3.31 / 4.11 | 9.52 / 15.24 / 22.60 |
| 128×128 | 3.14 / 3.76 / 5.00 | 2.97 / 3.73 / 4.49 | 12.60 / 15.27 / 20.86 |
| 1×16384 | 3.45 / 3.96 / 4.82 | 2.85 / 3.26 / 6.60 | 10.45 / 11.74 / 13.73 |

## 已证实瓶颈与候选

`apps/server/src/m2-workspace.ts` 的projectCommittedEvents更新查询在已追平后仍扫描全timeline和feed：128任务场景扫描16,384 timeline行+16,512 feed行，EXPLAIN实际6.713ms；单任务长历史空HTTP页仅470bytes，仍扫描16,384+16,385行、6.788ms。LIMIT200只约束投影插入数量，没有约束为寻找缺口而扫描的历史量。原始EXPLAIN ANALYZE/BUFFERS计划在JSON中。

候选只使用现有索引和事务：每task通过 `(task_id,task_cursor)` 索引倒序取得最后投影cursor，再通过timeline主键按 `cursor > projected.task_cursor` 读最多200条；保留最终全局排序/总LIMIT200、投影锁及acceptance先于output。没有全局source sequence/createdAt高水位。候选已在受控窗口完成8组结果等价检查，现已按同样查询应用局部产品修复；分支功能测试通过，修后HTTP性能复测/独立review/main集成分别待核。

安全前提：现有events、commands、reconciliation和protocol-dispatch写timeline都在同task行锁内分配cursor并提交；同task较大cursor不会先于较小cursor提交。投影批次按每task cursor递增，因而已投影为前缀。跨task晚提交仍由各自独立cursor发现。交付前必须原样跑晚提交A/B、201task及并发投影回归，并新增同task锁/200事件边界证明。人工绕过行锁补写较小cursor不在该前提内，应明确而不是静默忽略。

即使采用候选，task扫描、每task索引探测和全局投影锁仍存在；不把它称为与任务数无关的全局有界工作量。不需migration或writer接口改变，是否接受此不变量依赖由独立review判定。

## 当前边界

产品局部修复已在分支通过功能回归，已获mika独立APPROVED，尚未完成修后性能复测或集成；独立review/main集成分别见[status](../../../plans/b01-bounded-reads/status.md)/[review](../../../plans/b01-bounded-reads/review.md)。没有真实模型容量、并发执行压测、跨机网络或UI性能证据。架构无产品变更。

## 候选对比与功能修复进展

第二窗口2026-10-06T03:39:08.250Z–03:39:23.876Z，Web正式计时尚未开始；15.626秒、31个命名检查、47,496,495响应bytes，exit0，全临时资源清理。固定测量提交 `bb81fba9f08aeebac80b9b264fe423edc062eb02`，原始[candidate-results.json](candidate-results.json)含源码hash和真实查询。8组backlog/追平结果一致。128×128追平时原更新6.995ms、候选SELECT0.728ms；1×16384原更新7.313ms、候选SELECT0.034ms。二者分别为INSERT与只读SELECT查询计划、单次EXPLAIN，不能直接当修后HTTP提速倍数；决定性证据是无新增事件时长历史Seq Scan被零行索引探测替代。小128行场景PG仍选择Seq Scan，不能承诺所有规模强制索引。

产品修复限定两个已amend文件，保持现有投影锁与总/每task200条上限。8项真实PG行为回归通过，功能窗口03:42:24.054Z–03:42:29.801Z，5.747秒；[结果](workspace-tests.json)/[命令](workspace-test-command.json)。保留跨task晚提交、201task、并发无重复等6项旧测试，追加同task行锁前缀和450事件跨批次2项。测试现在只创建/销毁唯一临时flow_m02_test库，不再清空共享flow_m02。功能测试期间主机并不空闲，耗时不作性能证据。

[首次失败](workspace-tests-failed.json)为新增测试持锁等待FK插入造成，已按合法事务时间线修复；详见validation-history。此行为也提示workspace原有FK锁等待仍可能影响延迟，当前修复不声称消除写入争用。

独立review：mika已批准实现 `70af7b45814d5ed31d9638649512358e1a0a834b`，另行8/8功能复跑通过（5.98秒），无findings；[review记录](../../../plans/b01-bounded-reads/review.md)与[原始stdout](independent-review-checks.txt)。
