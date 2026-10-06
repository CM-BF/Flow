# D02 权威进度来源同步证据

本分支从D01 `6783562696cd268274398a02ebd3dff41aed2ce0`追加已确认来源；不修改status解析器、review语义、UI、根依赖或其他owner记录。现有4320服务保留，检查使用独立动态端口并关闭。

## 来源与现场核对

| Task | 唯一权威worktree（Flow-worktrees下） | status |
| --- | --- | --- |
| R02 | m1-native-harness | plans/r02-native-harness/status.md |
| I01 | m1-integration | plans/i01-integration/status.md |
| LAB01 | performance-probes | plans/lab01-performance/status.md |
| LAB02 | observer-probes | plans/lab02-observer-probes/status.md |
| D02 | dashboard-progress-sync | plans/d02-progress-sync/status.md |

新增5条后共14条来源，既有9条来源不变，FLOW-001/FLOW-002/FLOW-003/OPS-001仍只读plan-status-review。D02自己也有唯一status，避免新增任务不进入聚合。R02/I01/LAB01原bullet字段由各自owner规范为元信息表与TODO ID，未在聚合器猜测状态。

[HTTP快照](live-snapshot.json)来自真实GET /api/snapshot；[核对结果](live-checks.json)包含各状态文件SHA-256、Git现场HEAD/dirty、更新时间、错误/unknown/review结果及源码摘要。检查直接读取注册路径，与GET /api/document返回文本及snapshot解析结果逐一比较，并确认读取窗口内文件未变。源在后续提交后变化是正常现象；此证据是观察时刻的记录，不是第二份手填事实源。文件读取不是跨worktree原子快照。

## 检查与复跑

Node24.20.0，已有10条隔离样本测试全部通过：[结果](node-tests.txt)。覆盖owner选择、缺失/冻结/陈旧/冲突、空review、main与review目标分离、资料路径/symlink/Host/XSS等既有行为。新增真实source检查脚本只在显式调用时执行，不混入普通隔离test glob。

```sh
/opt/homebrew/opt/node@24/bin/node --test apps/execution-dashboard/test/*.test.mjs
/opt/homebrew/opt/node@24/bin/node apps/execution-dashboard/test/progress-smoke.mjs
```

在此worktree根执行。smoke会覆盖本目录live-snapshot.json与live-checks.json；保留原始证据时请先复制到独立位置。服务通过listen(0)分配loopback端口，finally关闭自身连接。0模型、0云，不重启4320。registry/script语法、diff和相对链接检查通过；UI没有改动，未重跑整套浏览器。

## 保守解释与限制

- snapshot的`current`表示状态记录完整且来源/Git/时钟可核对；`main.current`表示声明main SHA与现场一致，**不表示已合并**。具体集成事实保留原文，既有UI遇“未集成”仍显示未集成。
- LAB01完成4/4，检查target为历史实现f226c42，review按既有规则为outdated，因为metadata HEAD不同；没有给当前HEAD继承approval。R02的PASSED审查原文不是规范APPROVED，故review仍unknown；I01范围审查/旧模板不当成整体验收通过。
- I01的83/84历史FAILED及修复说明从owner实际status投影，不替其宣告新全检通过。查询时若owner已有新提交，以源文件及快照时间为准。
- LAB02 owner确认其实现中、尚未测量，现场Git dirty如实记录；D02自身review模板NOT_STARTED不显示通过；未识别检查字段保留unknown。只登记/读取，不启动真实模型或触碰核心任务执行。
- 非阻塞候选：metadata review目标与HEAD分离；过滤“无/无新增事项”决策；历史风险/已解除/容量限制与当前阻塞区分；工程SHA原文留详情。本轮不重做这些UI与语义。

技能发现、来源版本与clean-code实际应用见[质量记录](quality.md)。最终实现/交付SHA见[唯一status](../../../plans/d02-progress-sync/status.md)，独立review另行执行。

末次交付前核对：5条新增来源均live/current且无解析issues，旧9条登记逐字不变；R02 5/5、I01 3/5、LAB01 4/4、LAB02 1/4反映观察时刻的owner记录。D02最终完成状态在后续metadata快照核验。所有源码hash相同；无新增UI与浏览器验证结论。
