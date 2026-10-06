# SVC02 32c实际更新与恢复（窗口CLOSED）

执行owner assignment_review / gpt-6-astra，新claim a5c0fc33-356c-434b-8508-67796d21d414 v1。实际固定source **32c371d389a913f8dd71c3bd8b98dd0697411256**；原DB/runner/profile/目录/端口保留，工具实现未变。本次只保存操作证据，未重跑产品套件。

GO通过Lead明确EXECUTE_AND_RESUME_GO SVC02-32，08:25:36–08:40窗口。08:26:51 fresh全库无未完/uncertain/待排且身份通过；08:26:57.892一次bootstrap使原runner draining v7，新operation **4ee51717-972d-4396-8410-72e7a7158063**。fresh再次无工作后，08:27:09.941 hold/refresh成功，v8 maintenance、ready-paused。新owned PID=PGID center33877/runner34058/Web34097，全部身份/监听/健康通过；没有强杀/删除数据/换身份。

## 保留核对与原false

[更新前](refresh-32-before-drain.json)与[更新后](refresh-32-after-refresh.json)保存所有既有flow表的有界逐行JSON摘要/列集合，均完整；54个旧业务表完全一致，9类主记录ID/行摘要一致。旧1..23迁移整行记录逐值不变，新增单024；steering三新表为空，不启用原profile的activeSteering。旧维护audit6行摘要仍全在，仅本次drain/hold追加2行。

私有config/claude文件本机字节SHA比较相同（不将私有哈希/token输出Git）；0700/0600/uid/非symlink、marker与runner凭据身份、native目录dev/inode、原profile全部一致。配置继续sonnet5-5/none/0工具/2turn/$.20/60s，不更改组织资源。

[初次checker](refresh-32-preservation-initial.json)原false保留：runners排除了state/version/op但没有预先排除maintenance_updated_at，因此此行摘要随合法维护变化。Root实际读固定store UPDATE后明确接受第四列属于预期变化；详见[暂停回执](refresh-32-paused-receipt.json)。不伪称runner整行逐值不变，也不重采倒推旧值。原始旧row未留，只有分开核对的正式身份/harness/capacity/revoked/attempt/profile字段及固定语句仅更改四维护列的证据。conversations.queue_checked_at亦明确在原采样前排除，不能声称保留其原值。摘要用于变化检测，不是可恢复备份或密码学真实性证明。

## 用户新工作与明确恢复

Root先给RESUME_GO SVC02-32-0828，但[08:28:47 fresh gate](refresh-32-before-resume-checks.json)发现新用户queued1（tasks2→3、conversation1→2、turn2→3）；本owner按条件停止resume并报告，未取消/改写任务。该false门禁完整保留。Root确认用户刚登录61228提交的合法请求应继续，追加 **RESUME_GO SVC02-32-user-queued-0829**，明确复用该fresh快照，不为queued重采，并允许恢复触发该用户正常模型工作；不是实验预算。

[一次resume](refresh-32-resume.json)于08:29:29.365完成，v9 accepting，中心operation按原语义清NULL，本机保留同operation/resumed。[08:29:40后置](refresh-32-after-resume.json)确认同source/身份、三组健康；当时全库4 succeeded、未完0，期间又有用户正常请求。此计数是中心任务状态，不等于用户业务语义或UI独立验收。本owner主动提交任务0、query0、取消0、tab操作0；没有生成O10许可或调用实验模型。

本次窗口CLOSED，工具/服务操作停止。runtime固定32c/v9是时点事实，不追随main metadata自动重部署。新维护仍需独立窗口；不自动回退schema、不删除原state/数据。此次有条件授权和差异解释均留原始事实，不将最后成功改写为过程中从未失败。
