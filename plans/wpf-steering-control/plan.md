# WPF-STEER01 独立运行中指令控件

创建/更新：2026-10-06 08:46:54 UTC；状态：in-progress。U11/REQ44，唯一owner workspace_panels_owner / gpt-6-astra ultra。

目标：基于已批准公共admission和acceptSteering契约，实现独立可接入控件，明确中心受理、runner收到、观察消费与模型遵从的区别。新草稿与未知回执并存，原key/body可页内重试。此片不等个人部署，不接App/Thread或默认SDK steer。

固定输入ca4c3f723d2f786601e7cc9bd0363d756d974810，新web-steering-control / codex/web-steering-control。写入仅[status](status.md)6生产/测试及本plan/evidence；[receipt](../../docs/evidence/wpf-steering-control/take-receipt.json)先COMMITTED/live核。无shared/App/Thread/queue/session/权限注册表修改，0真实模型/DB/个人服务操作。

方案与边界见[interface](../../docs/evidence/wpf-steering-control/interface.md)。小control接口收绑定task/connection、可撤销host port；admission仅新提交门禁非预留。公共schema校验UTF8≤16384、digest后冻结attempt/owner/revision/text/key；savedACK不能降级更高receiptRevision。曾unknown后4xx不能洗成未执行，retry不绕host授权。元数据/receipt有界，unknown不淘汰，预算满拒新handoff保留草稿。隐藏不是中心取消；读与命令有generation/abort与late保护，无新轮询。

- [x] WPF-STEER01-01：固定输入/领取/技能与Interface。
- [x] WPF-STEER01-02：独立control、严格身份与回执、有界分页/生命周期。
- [x] WPF-STEER01-03：独立UI与HTTPfixture/直接检查、双主题390键盘。
- [ ] WPF-STEER01-04：clean-code、固定target独审、来源聚合与交付。
- [ ] WPF-STEER01-05：后继App/P01接线与跨reload原key恢复，另take，不在本片完成。

验收：ready→陈旧CAS失败刷新；lostACK→attempt结束/撤权4xx仍未知；replay不降级；同revision刷新已加载receipt；wrongtuple/digest/bytes/坏2xx；并发digest门禁/所有Promise处理；隐藏/离线/撤权/换连接late；预算满不丢unknown；新草稿、IME/Enter/ShiftEnter、双theme390。真实公共FlowClient+独立HTTPfixture，不冒称真实中心/runner/provider。

所属大task为 [WPF-MATURE-06](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/wpf-mature-06-chat/plan.md)，co-lead Web /root（执行管理 d01_owner）；WPF-001仅既有需求追溯。本控件完成不等于整个大task完成。
