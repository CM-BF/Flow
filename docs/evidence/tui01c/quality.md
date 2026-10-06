# TUI01C 技能与质量

2026-10-06 10:45:05 UTC：TypeScript shared protocol/controller + Ink。按find-skills本地优先，实际读 /Users/citrine/.agents/skills/find-skills、codebase-design、clean-code、tdd 的SKILL.md；clean-code沿已固定sickn33 bdacd76来源、不重装。实际复读 /tmp/flow-tui-ink-skill.md（官方assistant-ui/skills 139674dc888ee076982b6726e8e6f5d0fe0b5f67）。

应用：单一协议规则提取，browser-safe子路径隔离Node依赖；公开seam红绿行为测试；不复制Web状态宿主/renderer。设计阶段clean-code核状态所有权、错误取消、资源界限，无未决设计阻塞。普通实现已授权，不追加技能审批。

2026-10-06 10:52 UTC 工作段检查：共享stream提取，Web保留renderer/host，activity只共享codec；单turn观察/2并发4等待/4body缓存均显式。HTTP7/7、direct30/30（含shared2+预算2）、真实PTY1/1，38 distinct。首shared-red是模块缺失加载红，不称行为红；http-initial因合成fixture source/body字段错误4红已纠正；pty-initial真实PTY已过但eval根包解析失败，改为真实headless入口后全1绿。原输出保留，0provider/0个人服务。Web尚待F01锁输入再验。

2026-10-06 11:02:23 UTC 交付前clean-code：核shared presentation/projection/activity只拥有协议验证与展示结算，Node controller没有进入Web子路径；Web只保留UI转换，没有第二套长期settlement。TurnObservation独占选择/lifetime/cache，ObservationReads保持真实在途槽直到底层settle；退出/epoch不更改任务。修复完整detail被preview掩盖的hash校验；新增分页防止显示静默永久截断、活动stale明确。命名、错误、取消、资源上界、无凭据日志及重复检查已核。122 distinct按层去重，最终types0；不重复全库、不声称独立审查。后继无本片阻塞：更早历史/附件/交互控制/真实provider另验。

## 2026-10-06 新会话聚焦修复

原作者已明确停写，但现有worker followup被实际threadlimit拒绝；未重试绕cap。Execution Lead经handoff/accept v4在原树仅修controller与直接消费者。沿既有find-skills发现和codebase-design/clean-code方法，保持中心状态与本地观察职责分开，仅在已确认ACK、durable intent清理成功且epoch仍有效后重置跨会话本地聚焦。未知ACK不清意图/不换请求，正常发送同会话不重置用户选中轮次。新增两例先红后绿，root types0；原122例不重复。原实现与全量独审仍绑定d26dde66；此次仅增量。
