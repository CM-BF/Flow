# SVC02 新维护窗口方案（只读准备）

本次操作owner assignment_review / gpt-6-astra；原实现作者runner_owner。新claim d582c0ca-4812-45da-978b-2ad91b403140 v1；canonical仍preview-refresh / codex/preview-refresh。原SVC02工具实现9aa790已独审并交付，本次不改实现、不新建权威计划。

精确部署候选 **b54de1dbb08e3ccc7d33a27295a318f2799e76ae**，为原固定已审产品253b8ad38fd869297e7d9948a26c1d310fef5c6c的metadata/registry后继；Lead已确认apps/server、apps/runner、apps/web、packages、tools零差异并冻结main至窗口结束。实际配置repository指向主checkout，工具要求其HEAD精确匹配；不能用本证据工作树代替、不能reset或改private config迁就target。最终只读源核验另见manifest。

## 已保存的现态

[07:28:44–45 UTC只读事实](refresh-253b-readonly-facts.json)：三项受管服务running，center61227/Web61228监听归属正确；wrapper PID/PGID分别77104/77264/77304，center child77136、runner child77297、Vite77337。cwd为主checkout（Vite为apps/web）；原启动source记录fb906cb，不能把今日源码HEAD当作已部署。Web由Vite提供，可能随checkout变化，不声称现有用户tab已完整更新。

私有目录0700，config/claude/state/maintenance四文件0600、同uid、普通非symlink；DB marker与runner token归属比较为true，未输出secret/连接串/token哈希。固定claude配置未改：sonnet5-5、0材料/0工具、2turn/$0.20/60s每query；provider未探测。native工作目录inode保留，operation.lock不存在。私有比较基线仅在本机0600 `/tmp/flow-svc02-private-baseline-253b-final.json`，不进入Git。

全DB共2任务均succeeded、2已结束attempt、1session、2artifact、12details、1conversation/2turn、1queue记录且promoted；未完成attempt0（含uncertain计数0），无queued/waiting/cancel_requested任务或等待队列。唯一注册runner d22f4df2-8242-49f4-a1b4-77f8f08611ef、nonrevoked、capacity1、accepting v3。现库迁移1..16。扫描识别的本机runner main只有上述一个。单runner操作依据是本安装已知部署记录、正式持有身份和完整全库未完快照；这不证明理论上不存在异地主机/自定义入口/同凭据隐藏部署，也不将此理论限制升级为新的用户确认要求。实际出现第二部署记录或无法核对的持有身份才停止并协调。

首次只读查询误按不存在的attempt.created_at排序，SQL42703已保留在[初次unknown](refresh-253b-readonly-initial.json)；连接随后关闭。改为主键排序后另存最终事实，没有删失败、迁移或写DB。采样已结束；测量静默窗口内无PG循环/服务操作。

## 提请GO的新窗口

此文件只准备，当前没有stop/drain/hold/refresh/resume授权，旧05:38/05:40窗口失效。GO新窗口应固定以上target、唯一操作owner与单受管runner，协调不并行变更部署/注册runner/主源码。不刷新用户tab，不提交任务，不探测模型。

1. 窗口开始再fresh核全DB所有runner未完成attempt/uncertain、排队任务与waiting queue、registered runner及部署、PID/PGID/cwd/监听、private files/marker/source。保存已有数据的ID/版本或脱敏摘要基线；本次准备只有计数，不把它当逐行数据保留证明。任何已知部署实际身份unknown只报告，不停止；不要求用户证明理论隐藏部署不存在。
2. 从固定main运行现有 `maintenance bootstrap`，其复用016并持久drain；不是重建服务。保存新operation/CAS回执，当前任务仍可心跳/上报。出现active/waiting决策/uncertain，保持draining并报告，禁止因先前0直接stop。
3. fresh核全DB无未完成attempt/其他部署后，执行 `maintenance refresh --target b54de1dbb08e3ccc7d33a27295a318f2799e76ae`。它在同runner锁下hold再提交，operation.lock覆盖本机更新，按已核自有组Web→runner→center TERM，随后启动原三角色。不中途持PG事务，不造第二中心，不SIGKILL/扫端口杀进程。
4. 新进程就绪后仍maintenance：保存新PID/PGID/监听/source、所有已知迁移与公开只读健康/配置、原marker/runner/profile/native目录、config/claude逐字节不变、旧任务/会话/产物/queue身份与摘要保留。只读测试不能叫真实模型或UI验收。直接依赖旧/新reader组合的已审证据在manifest引用，不重跑产品套件。
5. 把fresh结果交GO；**只有新一条明确resume授权**，才再次核同operation/source/自有进程和queue后运行一次 `maintenance resume`。resume可能启动合法queued任务并消耗模型预算，0任务快照不能代替许可。仍不自动发测试消息或刷新tab。

调用入口必须使用固定main的 `/opt/homebrew/opt/node@24/bin/node /Users/citrine/Projects/AgentHarness/Flow/tools/personal-preview/cli.mjs maintenance ... --directory /Users/citrine/.flow-personal`；不在本准备执行命令。

## 失败与回退界限

已成功drain/hold后发生TERM超时、source漂移、迁移/启动/身份失败，一律不resume；留原operation/state及unknown，停止继续变更。不把进程退出当任务成功或副作用撤销。bootstrap本身未知时不能声称已经暂停，须核持久状态。停止工具每组5秒、无强杀，生产main总20秒异常退出保险不等于工具能确认其及时停止；超时按unknown处理。

保留原DB、凭据、native目录、端口和地址，禁止DROP/删除attempt/清operation.lock/伪造PID/手改maintenance字段。升级迁移会持久提交，不自动倒退schema；失败后回退旧源码也必须另作兼容性评估/批准，不能凭旧target存在就启动。没有备份恢复证据，不把本快照称可恢复备份。优先维持暂停并前向修复；已运行旧服务在尚未进入窗口时保持原状。

单runner工具没有全局多部署drain；实际发现第二活动部署或已知部署身份不明时该方案不适用。managed plugins/skills沿现有原生环境，不绕组织配置；不声明hook无副作用。安装/启用插件、child工程执行、provider健康调用均不在窗口范围。

## 直接依赖的既有审查

本次复用已保存审查，不重跑产品或重新批准各领域：

- SVC02 `9aa790552cb8847d6feb8c8f90c870407a54e572`：Root批准单受管runner维护/host持有，9PG+12host原证据；此次最后核tools/maintenance领域对固定产品范围无变化。
- R04 `dc1d02fcb7e3edbf99921275d81412768bf08424`、R03 `9c59740fd45575c7ca5cccbdfdbd5772e5cf1d2a`：有限HTTP关闭与保守租期均已独审。仍遵守5秒host停止unknown与新runner旧center缺字段failclosed，启动顺序center后runner。
- K02/O07生产 `549f6b3e54f902d7b75ebe6d17f293a2085e7a6c` + 隔离修复 `d6406f906829b875d062e875dbd5aca613500e16`、CHAT05生产 `9ea33ef61da2304123d08ea87558023d63b38468`、K03生产 `44bd8bc8e8e30ec49f86b6828f4947bf2c47d148`：各固定生产挂载及直接消费者批准已记录于F01 review。不是本次native调用证据。
- CHAT06领域/旧读者、生产 `da7ad400e6e431d46ac0c4c23cde92e9b1f6e5c2` 与C02组合 `694c3fdbd6ef4affa66140f13a039156f27023e0` 已分别独审；Web reader `8c56211739ae0c20816c67caad13cee510130514` 与活动cursor兼容889片段由I02成套接收。只代表代码/已存组合证据，不代表本次用户tab观察或真实provider流式验收。
- X05生产 `3691d1b3dffa5eb33546ff3b84f45fa88401a9d5` 为可选host配置。现preview环境只映射固定center/runner/Web必要变量，没有包fetch host设置；本窗口不启用npm下载/安装/执行。

引用：[SVC02 review](../../../plans/svc02-preview-refresh/review.md)、[R04 review](../../../plans/r04-center-shutdown/review.md)、[R03 review](../../../plans/r03-runner-reliability/review.md)、[F01 review](../../../plans/f01-shared-domains/review.md)、[CHAT06C02 review](../../../plans/chat06c02-stream-compatibility/review.md)、[Web reader review](../../../plans/wpf-chat06-compatibility/review.md)。历史文档中的待审段落按其后正式批准增量解读，不把空模板当通过。
