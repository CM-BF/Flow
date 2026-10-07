# S01 A/B 已审准备入口

2026-10-06 14:12:22 UTC，owner status_read / gpt-6-astra，co-lead Mika。权威worktree `/Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-capacity-probe`，branch `codex/runner-capacity-probe`；writer `508f9c85-a27c-4382-bfe9-caca43be4b0e` v1保留原四literal。

固定修复target `d3ba03a88b8d25d134b7abade7f55f8198b182ba`，delta [manifest](manifest.json) SHA `4a555e969cb445e913c6bb5bf99a7757166eb3a73c56cabc2bd445a53ab39040`。architecture_read于14:11:28 UTC独审APPROVED、Mika于14:12:06 UTC正式接收；[回执](independent-review.json)。仅准备批准，唯一P2关闭，0剩余P1/P2。

完整实现以[原准备入口](../review-ready.md)和原da932固定Git为基础，叠加本delta的ab-input.ts、ab-driver.ts及新增preparation-git.test.ts。原87项/977生产blob清单、原61检查均按历史固定Git复用，不冒称所有旧source仍与当前WT相同。delta18项已独核。64 distinct=原61+新增3；本次17为重叠定向，local strict0。所有red/raw/manifest保持原字节。

固定生产A `a3e670b906c1b65d586b7730ca19da83109f1dcc`、B `aae1eb1054d75e78273e7c91ed048aeac80195da`，唯一生产差异为已审events.ts优化。统一300秒/512MiB、每侧135秒/240MiB、B至少150秒余量；未知或失败不启动B，不重试或补数。完整限值见[Interface](../interface.md)。没有实际导出固定输入、PG/HTTP/runner/provider或A/B结果；本片未集成main。

资源状态 **RESOURCE_HOLD**，资源条件 **PENDING**，窗口 **NOT_OPEN**。实际执行前必须fresh磁盘≥1GiB+512MiB，并由Lead/Mika确认共享PG/WAL资源条件、与其他实际窗口的串行安排及唯一OPEN和execution HEAD；本页不提供执行授权。当前source/raw冻结，不为等待空间新增检查、安装、复制、轮询或清理他人资源。

clean-code收口：本次仅核审批对象/历史撤回/测试去重/资源与运行授权边界；未改接口或错误处理，无新复杂度，无工程重测。唯一进度仍为[status](../../../../../plans/s01-runner-capacity/status.md)，不手填第二份进度数据。
