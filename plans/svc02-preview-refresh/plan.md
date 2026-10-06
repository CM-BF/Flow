# SVC02 常驻预览安全更新

编号SVC02；状态in-progress；创建2026-10-06 05:13:45 UTC。唯一owner runner_owner / gpt-6-astra。base6b4b89f397b35d7e769846df457e76bb29f4a265。

## 已批准目标

先停止接新任务，让当前任务/心跳/事件继续；所有未完成attempt（含uncertain）消失后才允许核验并更新自有进程。数据、凭据、native工作目录、端口与浏览器地址保留。更新后明确恢复接收，不自动运行queued任务。停止派发不是取消已有外部副作用。

旧75a33中心不认识维护API。明确受信本机入口核私有配置、专库marker、runner token hash、进程身份及operation.lock，仅执行016迁移与同维护domain事务；不创建第二中心或scheduler、不暴露HTTP凭据、不探测模型。migration默认accepting；attempt INSERT guard使用已有runner行锁，维护时让旧claim事务整体回滚。迁移短锁/SQL限时，失败回滚且不继续停止。

## 最小模块与并发规则

中心维护domain承担版本CAS、幂等、不可变审计与admission gate；claim仅调用gate，heartbeat/report保持原语义。状态accepting→draining→maintenance，后者仅在相同runner行锁下核completed_at IS NULL为0。事务在设置maintenance后立即提交；不跨stop/start持PG锁，避免新中心迁移/配置发布死锁。持久gate加HTTP禁止maintenance恢复、本机operation.lock覆盖更新；普通status/旧pending计数不授予停止许可。维护期间失败保持关门/unknown，不用revoke代替drain。

本机CLI保持operation.lock，停止只用原有PID/启动时间/命令/PGID核验，不扫描端口杀人。HTTP owner可停止领取或放弃尚未进入maintenance的排空；maintenance恢复仅可信host核新进程后调用同domain显式resume并审计，避免并发HTTP提前放行。无热更新、多宿主协调、通用服务框架或新依赖。

## TODO

- [x] SVC02-01：固定公开小合同与016/domain，真实旧claim SQL并发及完整回滚证据。
- [x] SVC02-02：受信本机bootstrap/drain/refresh/resume入口与私有持有校验。
- [x] SVC02-03：专库/动态端口0模型行为检查，失败保门与清理，固定证据。
- [ ] SVC02-04：独立review、main接收与另经批准的真实部署窗口。

共享exports/client/server mount由Lead接。精确scope见[claim](../../docs/evidence/svc02/claim.json)。真实61227/61228本轮禁止操作；当前仅临时专库/自有进程验证，真实部署须另给已审main/实际状态/回退语义并获Root窗口确认。

## 技能与验收

本地find-skills先发现，实际读用codebase-design/clean-code/brainstorming/tdd：小domain接口集中并发不变量，真实PG/HTTP与host CLI seam先红后绿；不安装无关技能。Root已批准设计，无需重复普通设计审批。每段与交付前clean-code检查记录own evidence。

测试仅本模块+直接消费者，flow_svc02专库/动态端口；不运行全产品/共享DB套。覆盖身份/旧version/同key异input/重启审计、drain与旧claim交错、已占用session回滚、heartbeat/outbox继续、uncertain阻止hold、显式resume、错误PID/TERM超时/启动失败关门。0模型/0云。

2026-10-06 05:36 UTC：已审实现9aa790552cb8847d6feb8c8f90c870407a54e572进入main fb906cb42391971a8b315dbd813f7633927d7265；SVC02-04仅剩单独窗口和真实部署记录。05:36:59Z原子amend至v2交回 apps/server/src/runners.ts，后续该文件由Lead协调新owner；本owner保留其余scope，不触碰现有服务。
