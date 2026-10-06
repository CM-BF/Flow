# WPF-ACTIVITYREAD01 活动信息的渐进展示

2026-10-06，状态：in-progress。唯一owner workspace_panels_owner / gpt-6-astra ultra。直接所属 [WPF-MATURE-06](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/wpf-mature-06-chat/plan.md)，co-lead Web /root；本片不代表完整对话体验Done。

用户目标：默认正文、简短自然状态与需要动作优先，技术信息按需。首片仅改善已展开的native活动区；外层MessageFooter/App/Thread正在STEIRI独立领取，不改它们，不更queue/回执/授权/公共契约或projection。遵守[模块规则](../../AGENTS.md#modular-design)。

固定base 3418fe682944145494463dca9e09f89c8b9c2295；独立web-activity-readability / codex/web-activity-readability；[take](../../docs/evidence/wpf-activity-readability/take-receipt.json)原五scope，09:39:42Z [amend](../../docs/evidence/wpf-activity-readability/amend-receipt.json)追加直接test为六scope。已有`NativeActivity({projection})`/`ToolHeader({title,state})`不变，使用现snapshot与触发方法，技术说明不是新的事实源。详见[Interface](../../docs/evidence/wpf-activity-readability/interface.md)。

- [x] WPF-ACTIVITYREAD01-01：来源/本地技能/领取/小Interface确认。
- [x] WPF-ACTIVITYREAD01-02：默认简短信息与Details，保留unknown/error/input-ready/truncated/redacted及恢复入口。
- [x] WPF-ACTIVITYREAD01-03：复用完整HTTP浏览器断言，0→1→cache、分页/两pane/草稿/离线迟到、双主题390与稳定截图。
- [ ] WPF-ACTIVITYREAD01-04：clean-code、固定target独审、交付与集成记录。

验证只本模块/直接消费者；真实模型/产品DB/个人服务0操作，独立动态HTTPfixture。报告全部写本片evidence，旧activity-i01只读。页码只表示当前已读页，不推总数；输入就绪不等于运行，活动成功不等于最终回复/验证；received≠applied回执不在本DTO中，不伪造映射。未知和权限错误不被Details隐藏。
