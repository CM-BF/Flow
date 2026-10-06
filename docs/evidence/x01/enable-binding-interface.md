# X01 enable/binding 当前实现 Interface

2026-10-06 23:36:16 UTC；source base60ca，首checkpoint9abf；v8/17scope。当前为源码实现，所有新检查NOT_RUN，不是完整X01交付。

| Module / 入口 | 权威与行为 |
| --- | --- |
| contracts/plugin-runtime | 严格有限host identity、enable/disable、task request、immutable binding、phase ACK和runtime读回；可持久化文本统一拒NUL/孤surrogate，正文16KiB，响应64KiB |
| plugins/storage.appendPluginRevision | 原注册revision/指针/audit唯一追加；旧四change与新两change共用，旧command codec不扩 |
| plugin-runtime/store | 官方034迁移、operator精确授权的不可变host tuple、最新runtime读回、task binding；不读包正文、不执行包；host publication不证明当前进程claim能力 |
| plugin-runtime/commands | enable检查当前选定version/config/grant/installed exact tuple，再追加R+1；task/binding/wake/command同一事务；phase先ownedAttempt/live/当前grant，后读幂等缓存 |
| plugin-runtime/routes | owner管理/读回与runner phase/host路由，沿既有认证；本片未在factory挂载 |
| runner/plugins/execution | 校验冻结task/input/material/runner，复用旧host两gate与稳定URL、原flow.text；返回artifact/verification/provenance，由后继runtime拥有序列/journal/完成 |

`POST /api/plugins/:id/runtime/commands` 是新独立命令合同；旧 `/commands` 保持四change，只扩旧operation读回kind和两个Web审计label。expectedRevision沿同一registration，HTTP idempotency沿既有operation+key。enable不要求安装的admitted_revision等于新revision；configure/select/grant后新binding需重新enable。disable只阻新binding，已受理的旧version/config/material pin不改，下一load/invoke仍检查当前tool grant。

phase唯一键为(binding,invocation,phase)，绑定task/attempt/ownerVersion/runner。换HTTP key仍只返回历史replayed ACK；同key也先重查当前fence/权限。runner拒绝历史、身份不符或解析失败ACK并报告unsettled；明确拒绝/fence错误原样传播。授权请求未知与包pending未知不等于已停止，后继必须沿原retained/journal停止新claim，不在这里自动恢复/重放。

host发布单独接受operator注入的同步 `TrustedPluginHostPolicy`，输入是冻结的 `{protocol,runnerId,storeId,hostApiMajor}`，runnerId只来自认证。store取得runner锁后、首次INSERT前只接受返回值严格等于true；缺policy或tuple不在授权中均403，错误首发不会留下不可变行。route只传递这个本地port，无公开路径配置、无新registry；生产factory如何注入仍由共享owner后继接线，现未mount。允许的tuple也不自证当前进程能执行plugin。

本片不能生产mount：共享owner还须完成v3 current claim资格/旧strict reader排除binding任务、完整请求journal、运行port/retained以及reconciliation拒绝丢binding重试。冻结tuple `{bindingProtocol,storeId,hostApiMajor}` 协商方向由Lead协调，本片不复制共享codec，不调用fixture fallback。actual runRunner/semver bundle/有来源event中心保存仍未接入；loaded/callable显式unknown。

验证准备（尚未运行）：合同6组；中心10个case真实专库/动态HTTP验证，包括034重入、单revision、CAS/replay、旧pin/restart、auth/fence/grant、约束失败事务回滚，以及缺policy/未授权runner/错误store拒绝且不留行后正确发布成功；其terminal installed来源是明确合成DB元数据，不声称下载。runner11参数化case使用真实自有小npm包、原prepareInstalledPackage/import/invoke，覆盖两gate/ACK未知/身份/持久化文本/空输出。旧plugins五kind直接回归与Web有界audit DTO label消费；Web不是enable交互或全生产旅程。所有运行须先由Lead准备依赖与开放各自资源窗口，当前未装依赖、未启动任何子进程/PG/浏览器/provider。

23:29补充：phase在registration锁、幂等锁/缓存及授权插入完成之后，再以数据库clock_timestamp检查原lease，失效回滚（包括replay）；仍不宣称最终query到COMMIT之间没有墙钟间隙。3个专属PID/pg_locks真实等待case源码明确覆盖这条边界，未运行。reason同样拒绝NUL/孤surrogate。
