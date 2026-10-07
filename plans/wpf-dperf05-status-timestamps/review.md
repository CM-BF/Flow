# WPF-DPERF05 review

状态：APPROVED — 仅固定 parser source 与 62 runtime evidence；aggregate/main/部署未验

Review target commit：c8d59449a5c4752fdf98a0cd7bb59653b6fbdab2
Base：ec5da343880879154e2392f52eaa915d5b08aa77
Scope：apps/execution-dashboard/src/status.mjs、apps/execution-dashboard/test/status-timestamps.test.mjs。

## 独立 reviewer 可复制任务

只读核工作树/branch/HEAD/dirty及固定 source manifest，读两源完整 diff。检查首时间候选、UTC/Z/+00:00、精度截断、严格日历/24:00/早年、异常隔离与既有输出兼容。确认专测未导入旧 PG/Git/HTTP fixture，测试结果与源码固定范围一致。无运行 gate 不执行检查；root review 由 owner 据原文转录，不自行批准。

## 当前结论

root 已独立核源码及唯一62项运行证据，0blocking，原始结论 APPROVED_SCOPED_PARSER_SOURCE_AND_62_RUNTIME_EVIDENCE。真实 aggregate/部署/main 不在当前证据内。后文为按时序保留的源审和运行历史。

作者固定输入：[candidate](../../docs/evidence/wpf-dperf05/candidate.json)。56 静态 case 不代表已运行。源 diffcheck0/四 scope外0；实际 parser/Node check、aggregate、PG/HTTP/Chrome、部署均未执行。

## 2026-10-06 19:02:04 UTC — R1 / P2

root 对676b源码独审，经管理正式派修：缺失/斜杠主更新时间被后来 main 同步救活；任务 ID 说明前缀误判日期。作者现仅两源最小修复及6新增待运行 case；原56没有执行。旧候选见 candidate-676b.json，派修/权属见 repair-request.json 与 repair-claim-observation.json。正式 root 原文待收到后原样补存，不自行宣称通过。

当前修复 target c8d59449a5c4752fdf98a0cd7bb59653b6fbdab2；62静态 case，全部 NOT_RUN。CHANGES_REQUESTED 保留旧审事实，新目标待独立复审，未自动批准。

## 2026-10-06 19:16:26 UTC — 实际review层次校准

原676b P2报告已原样保存[root旧审](../../docs/evidence/wpf-dperf05/root-676-source-review.json)，c8d修复[root源审](../../docs/evidence/wpf-dperf05/root-c8d-source-review.json)为APPROVED_SOURCE_SCOPED_NOT_RUN/0blocking；仅该限定结论被转录，不冒全aggregate/部署批准。[监督审查](../../docs/evidence/wpf-dperf05/root-supervisor-review.json)对应8256runner。

管理fresh gate之后唯一62/62实际PASS，证据见[validation](../../docs/evidence/wpf-dperf05/validation.md)。root实际direct证据review待回执，source批准保留与runtime结果分开。历史上面的NOT_RUN/CHANGES_REQUESTED段落仅对应其明确旧时点，不代表当前源码尚无源审。

## 2026-10-06 19:17:06 UTC — root 实际62证据独立审查

原文 [root-62-runtime-review](../../docs/evidence/wpf-dperf05/root-62-runtime-review.json) SHA256 6ca3a3433a333b463ac930cc71c93c002c9563dba1b1a34d5d6f507636b6fad5。结论 APPROVED_SCOPED_PARSER_SOURCE_AND_62_RUNTIME_EVIDENCE，0blocking，绑定c8d两源码/7311实际运行。result201ms与父stdout postWrite201.40412508044392ms分别保留；root核实际证据，未重跑62。旧676b P2关闭，不抹旧记录。批准不覆盖真实aggregate/main集成/运行部署；这些仍待Lead。
