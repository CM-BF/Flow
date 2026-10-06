# Web 管理需求的固定发布副本

本目录支持将管理者唯一权威来源发布到主线，让新clone与Claude Code读取完整需求。它不是第二份手工进度源。

- Canonical worktree：`/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management`。
- Canonical branch / owner：`codex/web-platform-management` / d01_owner。
- Canonical status：`plans/web-platform/status.md`；持续事实只在该worktree维护。
- 发布范围：仅`plans/web-platform`与`docs/evidence/web-platform`，由Execution Lead从明确、独审通过的完整发布HEAD受控同步；禁止带入产品或其它owner文件。
- 固定内容target、准备时间、独审和最终发布HEAD由[发布回执](receipt.json)绑定。主线integration receipt记录实际同步时刻/目标main；未收到前不称已发布。
- main副本反映该次发布时点，后续领取/实现变更不自动更新；新的发布仍从同canonical产生，不在main直接编辑一套新status。

阅读入口：[完整用户要求与REQ](../../../../plans/web-platform/plan.md)、[固定状态](../../../../plans/web-platform/status.md)、[本次审查](../../../../plans/web-platform/review.md)、[既有研究](../research.md)。已在接受main中存在的子计划链接已转换为仓库内相对路径，并由[映射清单](relative-links.json)保留原canonical路径和核验基线。

尚未合入主线的新feature canonical仍位于各独立worktree，绝对路径仅供本机实时查阅；新clone可查看[原样首canonical档案](active-source-manifest.json)。这些`.txt`原文带固定source SHA，不是可独立更新的状态源，不冒称代表后续产品进度。

历史c075批准仅见[原文](historical-c075-review.txt)。本次新快照须独立审查。工具/活动/stream的源码、fixture、模型、服务结论均沿原证据归因，管理发布不重新执行产品检查。

兼容性说明：历史delivery-snapshot及早期移交stub中的绝对canonical链接保留原时点，供拥有对应worktree的本机追溯；它们不作为新clone必备入口，也不冒称此时最新状态。完整U00–U12/REQ表、当前三件套、研究与本次管理证据均随两目录发布，当前核心入口不依赖这些旧worktree。
