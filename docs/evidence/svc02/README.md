# SVC02 安全更新证据

固定实现 `9aa790552cb8847d6feb8c8f90c870407a54e572`，base `6b4b89f397b35d7e769846df457e76bb29f4a265`，小合同祖先 `91878ab295ebbbff07e46f3e5fbf504bf063eca5`。独立worktree `preview-refresh` / `codex/preview-refresh`，[claim](claim.json)保持待review。0模型/0云；没有读取或操作真实61227/61228私有配置/进程。

## 能力与使用

[操作说明](../../../tools/personal-preview/README.md)提供本机显式bootstrap/status/refresh/resume。新增domain迁移016、owner读/停止接收/放弃排空接口，生产export/client/mount由Lead单写，本target没有改shared入口。模块导出 `migrateRunnerMaintenance`、`registerRunnerMaintenanceRoutes`，host复用 `commandRunnerMaintenance` 同一事务，不运行第二中心/scheduler。

已有任务继续，新的领取在DB guard和新claim轻门禁被挡。maintenance只在runner行锁内确认全部未完成attempt为0后提交；uncertain也占用。HTTP不能恢复maintenance，本机operation.lock覆盖更新；**PG锁不跨服务停止/启动**，避免新迁移/发布profile死锁。完成更新仍关闭领取，显式resume才允许队列继续。普通start/stop不解除gate；后者仍保留旧版明确停止进程的语义，不能替代安全更新。

## 实际检查

| 证据 | 源码与实际范围 |
| --- | --- |
| [domain-red](domain-red.txt) | 初实现有效HTTP入口返回501，首持久drain行为红；不是模块加载失败 |
| [domain-first-green](domain-first-green.txt) | 首纵向1/1：真实PG/HTTP drain、幂等、跨中心重启、显式恢复 |
| [domain-boundaries](domain-boundaries.txt) | 首6项中2项误读公共task返回shape，4通过；失败保留 |
| [domain-boundaries-final](domain-boundaries-final.txt) | 修正shape后6/6，不移除任务状态断言 |
| [domain-seven](domain-seven.txt) | 7/7，增加drain先赢行锁的真实旧SQL并发方向 |
| [domain-migration-test-timeout](domain-migration-test-timeout.txt) | 8通过，新增迁移测试错误地等待自身占用的admin pool，30秒超时；不是生产迁移超时 |
| [domain-final](domain-final.txt) | 最终9/9、2.49秒测试：迁移测试改用既有exclusive client；500ms锁限时确实回滚且未留列/016事实，解除后迁移成功 |
| [host-first-green](host-first-green.txt) | 2/2真实独立CLI：只安装guard不换PID、更新保留身份/端口/队列、显式恢复重放、错误PID拒绝 |
| [host-final](host-final.txt) | d12257f84e374ff038610c65fe4a3b14e678c10e：12/12，含4新维护+8既有启动器直接消费者；29.3秒。固定9aa的tools只规范缩进，`git diff -w`零差异，不冒称再跑过最终metadata |
| [typecheck-delivery](typecheck-delivery.txt) | 9aa工作树 `tsc --noEmit`实际通过；Node三入口syntax与diffcheck通过 |

测试专用 `flow_svc02` 持独占advisory锁，拒绝接管既有库；动态HTTP端口。迁移负例另创建随机 `flow_svc02_m_*`。首次超时的CREATE排队在exclusive admin client释放后才执行，留下本测试孤库 `flow_svc02_m_bb4ddb2208`；确认0连接后已删除，修正测试资源使用。最终只读核 `flow_svc02`/`flow_svc02_m_*` 均空。host测试使用新随机私有目录/专库/持有标记，finally核身份后逐项停止/删自有库；TERM不退的合成进程在测试清理阶段重新核其独占身份后SIGKILL，**产品仅TERM、有界unknown，无SIGKILL**。没有清理用户库或共享C01/I01。

## 旧75a33语句证据

[legacy-source](legacy-source.json)固定完整 `75a33dec228e17bbbd0d3be9fd01bc9ac18a0133:apps/server/src/runners.ts` hash。测试fixture仅改相对imports与来源注释，原claim SQL及控制流未改；公共helper取当前测试checkout，**不宣称运行了完整旧binary**。

真实输入由公共HTTP受理fixture task、旧函数领取并登记真实session，再受理resume task。drain后原函数先更新session占用，attempt INSERT由016 guard拒绝55000。独立查询核session.active_task_id=null、attempt无记录、task仍queued/current_attempt_id=null/owner_version=0，证明整个事务回滚。两个独立PG客户端另核两种顺序：旧claim先排上行锁则完成受理，drain必须等该attempt完成；drain先排上锁则旧INSERT被拒，任务保持queued。用pg_stat_activity确认真实锁等待，未mock SQL/响应。

另以实际runRunner+fixture HarnessAdapter在执行期间停止接收，真实心跳、assertOwnership与durable outbox最终消息/completed继续成功；上报重报ACK仍接受。权限拒绝、同key异input、旧version/错operation、审计UPDATE拒绝、重启保留、uncertain不释放均通过。

## Host边界与限制

bootstrap先核现0700/0600私有配置、DB marker/runner token hash、自有PID/启动时间/命令/PGID，不打印秘密。只做迁移与维护事务，不启动第二center或scheduler。016默认accepting；迁移失败不继续停止，drain durable后才排空。新服务需固定40位HEAD且clean；source核对失败保持未知/关门，不自动回滚源码或恢复队列。host测试确实启动独立center/runner/Vite，入库唯一排队任务为fixture，而保留的native runner仅声明Claude，因此零attempt/无模型。

并发保护是中心持久admission fence与同机合作持有协议，不是分布式OS事务或对恶意本机管理员的隔离。operation.lock无超时抢占；丢失/未知maintenance记录拒绝自动接管。任何曾发生外部副作用不因维护gate被撤销。provider仍not-probed，配置不等于在线；生产61227/61228仍75a33，真实刷新须Root另确认固定已审main/实际任务状态/回退窗口。没有容量、模型、跨机恢复或通用服务管理结论。

## 重现与质量

依赖Node24.20/pnpm9.15.4，冻结安装无锁变更。仅显式本域Vitest路径，以及Node `--import tsx --test tools/personal-preview/{maintenance,preview,environment,process}.test.mjs`；host refresh检查clean源码，输出先写独立tmp，完成再归档，不在测试途中制造dirty。metadata无新行为不重跑。

2026-10-06 05:23:40 UTC clean-code交付复核：domain集中状态/CAS/审计，routes只解析和授权角色；host只负责私有持有与进程协调，沿用原启动实现、无第二scheduler/credentials路径。锁只围绕DB事实，错误失败关闭；缩进修正不改变已测行为。测试超时资源误用已修，不延长timeout、跳断言或删除失败。剩余：shared接线/独立review/真实窗口另由Lead处理；HTTP maintenance恢复特意不开放。本段本地find-skills/codebase-design/clean-code/brainstorming/tdd已实际读用，无新技能安装。


## 独立批准及单runner范围

Root独立只读APPROVED固定9aa790552cb8847d6feb8c8f90c870407a54e572，现场clean129cc7751900809e321080d770c8a55710954ab1；核17source/12raw、manifest `6f46cd26a2435353d3e77e9f71fdd6f7ca418ed8d7736f50bfe814deb605805b`，完整代码/测试/输出，无blocking，0重跑。见[正式review](../../../plans/svc02-preview-refresh/review.md)。

批准仅单个受管runner的本机预览更新，不是整个center的多runner排空。真实部署窗口前必须确认全DB没有其他runner未完成attempt、没有其他活动runner部署；存在或未知时不能只凭本runner0就停止center，应保持暂停并升级协调。查询快照不是锁，idle runner无心跳时只能标unknown，不能推断其部署离线。产品实现不扩范围，原始manifest与source/raw保持不变；真实窗口由Root另确认。

## 实际单安装更新（0query）

Root批准的窗口于2026-10-06 05:38–05:39 UTC执行，操作源码为已审main `fb906cb42391971a8b315dbd813f7633927d7265`，原安装source75a33。唯一operator runner_owner，使用已审CLI，无产品改动、无第二中心bootstrap。

- [fresh全库/身份前置事实](deploy-before-facts.json)：唯一原runner，0task/0未完attempt，旧owned PID及原端口匹配。
- [bootstrap原始exit/stdout/stderr](deploy-bootstrap.json)：exit0，454ms，持久draining。
- [refresh原始exit/stdout/stderr](deploy-refresh.json)：exit0，2085ms，原子hold后更新自有进程，ready-paused。
- [更新后只读核对](deploy-after-facts.json)：新owned PID=PGID 77104/77264/77304 running，配置/native配置字节、native目录inode、DB marker/runner身份、61227/61228原端口保留；main未前进；migrations1..16；全库仍0任务/attempt，maintenance v2。
- [独立部署证据manifest](deploy-manifest.json)：不改写先前17source/12raw实现验收manifest。

未resume、未发消息或调用模型，provider not-probed。没有操作4320/49922或任何用户tab；未跑浏览器验收。窗口明确仅这一受管runner部署，观察快照不冒充持续锁/多runner排空协议。配置仅内存读取并比较，摘要不含token/hash值/DB URL；临时0600比较基线已删除。

## 明确批准后的单次恢复

前段保持暂停的部署回执原样保留。Root于同一窗口追加明确resume授权；[05:40:25Z fresh核对](resume-before-facts.json)确认全库0task/未完attempt、同operation/source/owned PID。随后[单次resume](deploy-resume.json) exit0/265ms，v3 accepting；[05:40:49Z最终事实](resume-after-facts.json)确认原3owned PID=PGID就绪、监听与61227/61228不变、主线fb906cb仍clean、全库0task/未完attempt及唯一原runner。审计完整drain v1→hold v2→resume v3，全部同operation。

[恢复证据manifest](resume-manifest.json)单列新增原始证据，旧deploy-manifest保留原时点resumed=false事实。本窗口没有消息、健康模型请求、模型query或用户browser操作；provider仍not-probed。只验证受管服务升级与恢复接收，不证明provider可用或真实chat完成。
