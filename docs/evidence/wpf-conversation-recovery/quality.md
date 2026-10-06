# WPF-RECOVERY01 质量记录

2026-10-06 13:49 UTC，workspace_panels_owner / gpt-6-astra ultra。读取本树根/plans AGENTS及模板；find-skills本地优先，已有codebase-design/clean-code/assistant-ui/brainstorming匹配，未重装。技能hash见[skills](skills.json)；clean-code沿全局固定bdacd76来源。此工作为已批准结构设计的实施，无需重复设计批准；canonical遵项目路径，未写skills默认位置。

首段检查：21scope与回执/live一致；公开client已核cookie/CSRF/credentials模式，未复制fetch。职责明确为连接观察、事务checkpoint、原命令authority、私有P01显示四条。主要风险为composer提前empty、CREATE阶段转换和跨tab预算/slot原子性，纳入直接行为验收。当前产品实现/测试尚未开始，不宣称通过。

## 2026-10-06 14:04 UTC 第一段源码安全点

原controllers继续拥有命令状态；Journal只保存完整原请求、CAS槽与预算，P01真实sidebar使用既有button贡献（首types发现错误panel种类已修），未造HostCommand。所有HTTP前等待事务complete；外部hash/network不进IDB事务。类型检查发现journal窄化已修。独审未开始，IDB边界与完整App接线未验证。连接read刷新对健康stream的代际处理、草稿hand-off与下一稿订阅仍在实施范围，不称已完整。

## 2026-10-06 14:23 UTC clean-code / moving预审修正

沿已读clean-code/codebase-design：原controllers仍单一命令authority；连接观察与journal不复制HTTP/DTO。App仅装配真实P01按钮和私有回调，复用现有knowledge/attachment/steering控制器，不新增registry。当前修改未固定；以下只有源码修正，尚未行为验证。

root针对82d的5项：①prepare失败不再endHandoff覆盖durable源稿；②事务加入真实expectedVersion CAS并拒绝accepted降级；③捕获namespace/owner/generation，恢复迟到结果复核；④写前storage失败保原key/body可重试，单独显示Not sent而非中心rejected；⑤logout同步撤销公共授权/CSRF，再以一次私有捕获CSRF调用已公开logout。原8项矩阵的行为证据均仍待测，不能称修复通过。

w01独立三项（原文及hash留early-peer-report.txt/source-manifest）：A accepted/rejected不再一律restore为unknown；outbox accepted引导打开已确认会话，queue保终态，steer验证并还原真实command checkpoint。B explicit resolve匹配后解除unverified并清提示。C文件名恢复改复用公共attachmentNameSchema，保合法255字符/512B边界。没有触碰旧uploadjournal的跨tab能力。

另root写放大建议已按对象身份仅put新增/变更record、删除实际移除key、同事务更新manifest，预算仍读当前全量；这是源码复杂度/写入范围改善，0浏览器性能结论。对当前App读取路径发现空center若固化/api会让公共client再拼/api，已改空选项规范化origin，显式proxy base path仍完整保留；不得私自复制client路径规则。

本段一次获准types耗时6.191s/exit2/862B，无deps/cache/emit/服务。错误为metadata unknown先过公共schema、journal union guard两处；已修源码但未再跑。原红log/sourceHashes保留app-wiring-types.*。当前status保持implementation/NOT_RUN与reviewNOT_STARTED。

## 2026-10-06 14:33 UTC clean-code 安全点

复核App实际装配、旧authority、slot与草稿交接，八项修正逐项见checkpoint-review-map.md；不把类型通过当行为闭合。新增记录与只写变化项的比较基准共享数组会跳过put，已把事务snapshot数组复制，数据实体仍按身份比较；这保留小接口而没有引入cache框架。CREATE alias迁移触发完整owner+draft checkpoint，避免同正文把route变化去重掉。合法filename和context ACK结构使用公共schema，未知附加字段不重复存入账本。

最新noEmit5.616s exit0，前次5.663s exit0，累计28.711/60s；每轮原始执行hash保留。13项直接测试已写但未跑（受控IDB端口，0真实IDB宣称）。源码暂停在固定安全检查点供root只读复核，后续继续fixture/必要行为边界，不扩21scope。

## 2026-10-06 14:52 UTC — f13 修复安全点

沿已读clean-code核错误处理和生命周期：open attempt与DB handle分离，失败只清本attempt；command authority首次await前固定，显式重试与自动继续分开；同key终态恢复复用原Outbox/Queue/Steer入口，不造第二decoder。只PUT目标记录，保全域预算/CAS同事务。记录root两P1/C1/C2+peer P2/P3+open P2均源码修正，未行为验；原82八项与f13报告原样保留。最新noEmit6.058s/exit0，累计40.603/60s，余19.397s。暂缓已批direct窗口等待X01实际结束回执，不把预计case数量当通过。

## 2026-10-06 15:03 UTC — R4-1 与单文件检查

Root固定4ba报告原样归档。首direct20/20，2.540秒、tmp9227B、清理无错误，全部mockIDB/mockfetch，不是真HTTP或浏览器。修复只在binding私有DraftState持有namespace/version，不从已撤权public identity判断成功commit是否发生；这只是CAS bookkeeping，不恢复授权/自动HTTP。新增精准auth-null用例，原跨中心/代际断言保留。完整Web noEmit6.059秒/0，累计46.662/60，余13.338；第二行为检查尚未执行。保原source-only review与原raw，不倒填首20case包含新修复。

## 2026-10-06 15:05 UTC — 同键终态binding清理

核root提醒成立：host终态对账成功后blockedCommands/handoff仍可能残留。修复仅已通过host完整identity匹配且namespace/generation仍current的terminal ID；handoff显式关联原commandId，不全量清保护。prepare事务真正commit后即记录source draft已transfer（version0），authgate仍拒旧HTTP；终态Restore保留并写deferred下一稿，失败identity不解保护。新增binding层受控case而非只outbox单测。完整Webtypes6.152s/exit0；累计52.814/60。行为仍待第二fresh窗口。
