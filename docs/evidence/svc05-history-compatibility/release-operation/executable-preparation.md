# 可执行观察与逐步记录（未执行个人动作）

本次仅两份必要的新脚本：`observe.mjs` 是 SVC05/live/facts 的有界 af51 适配；`preservation.mjs` 是同一 SVC05 比较法的纯阶段检查。没有新增 start/stop/deploy 入口，所有副作用仍调用已审 host。既有 center-recovery/facts 的 bounded/durable/sha、supervise.py 的外部 PID 期限直接复用，原文件逐字不动。033dd方案方向已由 Execution Lead 独立核41输入与4文档；本增量需其源码复审与唯一 af51 checkout 窗口。

## 准备实际差异

| 项目 | 原已审恢复 | 本增量 |
| --- | --- | --- |
| source | 362，同版本center-only | af51 checkout；观察到的runtime先362，refresh后才要求af51 |
| retained | 查362报告、两产物 | preflight可报告尚未import；材料gate必须是两old→af51及新d629报告，publish后验证三产物 |
| SQL | 同版本全表摘要相等 | 同一RR内同时保存raw/protected整行MD5数组；仅当前runner四维护字段和conversations.queue_checked_at从protected投影排除 |
| audit | 不增长 | 旧行hash/内容保留；准确新增drain/hold/resume，同operation/稳定key/trusted-host/逐版本与状态变化，禁止别的增长 |
| migrations | 保持1..27 | 精确schema列名/表名/版本/应用时间均相同，无新表、新列、补写或迁移 |
| CLI | 专门center-only operator | 原maintenance-host/CLI与已审单artifact脚本，各调用一次、逐步保存，无新部署FSM |

raw摘要永远保留：不因可解释的四列/扫描时间差异删除原false。对其它runner完全不省略列；旧审计行必须逐字摘要相同。新用户活动、未知部署、缺件、未知进程、schema/版本变化均停止后继，不能扩大白名单以凑passed。R01真实2App证据不等个人已发布。

## 固定执行输入

- `steps.json` 是20条准确参数与先前成功回执依赖，**不是自动循环/执行许可**。`{RUN}` 只替换为本目录下唯一新建的700操作目录；不得改其它argv。起点为新fresh快照，不把19:45旧零任务当准入。proposal中只用旧config/profile/installation/root identity作保护锚，任务/队列全部重新观察。
- `web-publish-request.candidate.json` 只有既有CLI四字段；窗口内逐字复制为 `{RUN}/web-publish-request.json`、600、wx+fsync，hash进入reservation。当前expectedVersion2，不自动追新revision。
- 原repo由Lead固定clean af51，并先核bound工具/源/依赖。`observe.mjs` 会实际解析root tsx/pg、server+runner已声明运行依赖与static host的Vite，记录版本/入口hash；不为已有静态网页重新要求React/CSS构建依赖或执行build。依赖必须留在原repository .pnpm或本repo workspace源码。缺件/解析失败停止，不连接candidate/donor的workspace源码。
- `observe.mjs <exclusive-output.json>` 只读本安装文件/精确owned进程/一RR数据库快照；不发HTTP、模型或任务命令。输出4MiB上限、100表/单表10000行/总20000行、审计1000、native目录512entry/8层/32MiB总内容与每文件8MiB上限。不是OS硬配额，任何越界unknown。
- `preservation.mjs <before.json> <current.json> <phase> <exclusive-checkpoint.json>` 只读保存的证据。phase仅preflight/materials/drained/paused/resumed/published。成功只说明该阶段检查全部为真；若返回false，先保存，不运行依赖它的下一命令。

## 逐步记录方法与时间

复用原 `center-recovery/supervise.py` 的 `supervise(argv, work_seconds, exit_seconds)`，每次只监督一条固定命令。维护命令直接使用原CLI实际启动的 `maintenance-host.mjs` 子入口，参数保持一致，并使用固定 `environment.mjs` 的 `baseServiceEnvironment('center')` 同一system allowlist环境；避免外层CLI被杀而其maintenance子进程继续未观测。其它步骤直接原CLI/已审脚本。supervisor只杀被监督PID，不向detached新旧服务group发信号。

每步先 wx+fsync `<id>-intent.json`，记录argv hash、source/input hash、开始时间、unknown默认结果；缺任一前序成功回执或已有本步intent都拒绝新调用。由operator人工选择下一固定step，不另建调度器。外层监督返回后将完整exit/stdout/stderr/elapsed/是否停止原样保存 `<id>-command.json` 并fsync；再由已固定观察/比较入口写下一检查点。证据写失败视unknown，无自动补调用。先读当前state/operation后另行协调，不凭CLI错误推定未提交。

建议单命令118s+2s确认，与原已审监督相同；自第09步drain开始，沿既有15分钟总窗口，后续单步取 `min(118s, remaining window)`，剩余不足即停止后继，不重置预算。这不承诺fsync/OS绝对完成；独立监督期限决定operator是否停止，服务不被它强杀。阶段stdout/stderr合计实际计量，原始记录观察上限16MiB、始终保留1GiB实际剩余；达到线先保存unknown并停后继。输出写入失败不继续发布。当前未生成授权/预约、未调用任一步。

## 阶段检查点

- 01/02：新fresh config/root/runner/三owned与全库零未完/uncertain/pending/queued；如果用户有新工作，只报事实/等待其自然结束，不取消。基础快照成为本次保护锚。
- 03–08：原工具导入3报告，已审精确搬运d629；此时数据库、native文件、所有状态与pointer仍须不变；新af51报告与候选资产完整后才drain。
- 09–14：drain→零工作观察→hold/refresh→ready-paused及旧数据保护。原Web/runner/center会正常重启，caa1/v2 pointer不变；这不是center-only。
- 15–17：明确一次resume并保存实际maintenance/audit/三owned。若新用户工作开始，比较失败保持真实差异，交Lead判断，不能自动忽略数据变化或停用户任务。
- 18–20：独立Web指针一次publish，预期af51/d629/v3；保留3产物。identity失败可能已提交，原报告不改、不自动rollback。最终完整回执持久后才通知Lead可恢复开发checkout。

执行前的原始记录位置、主线refs与私有身份由新reservation绑定；本目录里的旧恢复authorization不能授权这些步骤。外部TSX checkout仍不是immutable runtime closure，SVC06后继保留。

## 静态检查范围

仅新两脚本的Node语法解析；未import脚本、未调用观察/比较、未访问个人配置或PG、未生成run目录。实际保留/操作结果均NOT_RUN。参考来源是Git固定SVC05 `live/facts.mjs` / `live/preservation.mjs` 和本H已审center-recovery方法，不复制旧25–27新增列特例为本次允许变化。
