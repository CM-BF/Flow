# 晚开路由修复后Steer实际恢复

执行HEAD `d06baf3c70cddcb1614088ac2349a1d416d61851` / source `a80339a463c4a1a1a5a679d9a89ea79b1650340e`，原21/6ffv4、原Steer actor及parent。Run `recrtfix-20261007-102945-f71af8`。作者actual **cookieRead+steeringRecovery 2/2 PASS**、actual outer exit0/双EOF，非整feature批准。

实际10:30:07.029323Z→10:30:22.148717Z；outer15118.727791ms、late14518.907833ms、serializedparent14503.140875ms，保守charge15119。新route-fix90s累计15119/余74881；旧90/150/Steer60全closed、旧两红不改，serializedparent旧prior口径不当phase信用。

真实same-document hash打开新conversation（timeOrigin相同），首turn202持久化精确outbox record，frozen.turnKey/request与原HTTP相同、accepted checkpoint的turn/task同ACK。随后真实Guide输入保存原task/turn/message草稿，reload/reauth后显式Restore不业务POST；原steering完整upstream ACK的真实prefix body-loss被同Request观察，journal进入unknown。下一Steer稿另存并恢复，恢复原unknown仅恢复权威不发命令；用户明确Retry保持原key/body/attempt/ownerVersion/expectedRevision，真实202回放同command，最后accepted与下一稿均保留。业务POST计数[1,1,2,3]。

一个synthetic public actor：4次有限ready claim请求中一次successfulclaim，1session事件、0heartbeat/runnerreceipt/provider/SDK/runRunner。center accepted/replayed不等native模型consumed/applied，预建pinned conversation不冒新聊天profile discovery。初始化8403.469459ms、cookieRead1293.068500ms、Steer4136.056917ms；这些是本次测量，不宣称相对历史性能收益。未选其他组，不新增截图。

原件：[11raw40748B和10outer原件索引](stale-route-first-manifest.json)，private外层原件`/private/tmp/recovery-routefix-first-wm_9mx_o`。188历史browser raw逐字对Git d06，19源码对a803，均无变化。10:30:49.963232Z fresh outer23329/parent23339/worker23351/Chrome24441全部PID与PGID ESRCH；scratch `/private/tmp/flow-recovery-browser-FotWwt` absent。原DB marker/0conn/normalDROP remaining[]，fixturecomplete/errors[]，parentallgroupsabsent；admin0600 exact dev/inode/uid核符后删除，value未读印/postENOENT。未另采port；原fixture close与process absence是收尾证据，非单独socket检查。共享窗已立即归还，0holder。

此轮支持已确认静态旧回调缺陷的修复有效：原真实两红均无command/Steer草稿，本轮在保留原流程下same-document/durable原turn/完整Steer链通过。历史失败不能回写成PASS，不能断言所有潜在保存故障唯一根因。

TODO对应：02四类原authority/durable barrier和CREATE两阶段/Queue/Steer原身份错误恢复均已实现，并有受控与对应真实选组；本项按其实现+限定验证定义完成，不冒promotion/native应用。03完整草稿的text/profile/project/knowledge/orderedfiles与Steer各有实际证据，跨第二center/principal隔离仍未验。05保原各旅程，task SSE非assistantstream，二中心与全部重连边界未验。06完整feature独审仍IN_PROGRESS/main未接。视觉后继在原MATURE01/06队列，不混本轮代码。

独立验收（2026-10-07 10:36:27 UTC）：[root原件](stale-route-first-root-review.json)，18127B/SHA256 `e6c904e0fe1dd932902b682e43809680ee0791a160f85f37b67ab12192d6e752`，结论`APPROVED_SELECTED2_PASS_NOT_WHOLE_FEATURE`。原manifest保持审查前字节，所有旧失败/未选范围不变。
