# WPF-ATTACH01 附件资源与固定文本上下文

2026-10-06 10:20:46 UTC；状态 in-progress。唯一owner workspace_panels_owner / gpt-6-astra ultra。直接父 [WPF-MATURE-03](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/wpf-mature-03-attachments/plan.md)，co-lead Web /root。遵循[根模块规则](../../AGENTS.md#modular-design)。

用户结果：中心准备固定版本文本附件，Send/Queue按明确顺序冻结，远端runner经既有授权claim读取相同材料；不把本地File/预览冒充已送达。当前phase1只交typed合同、Interface及pure直接测试，未实现上传路由、数据库、真实App或provider。独立树attachment-resources / codex/attachment-resources，固定base f181d84b5fb3652d62e2a181acff442d42b3e066。

- [ ] WPF-ATTACH01-01：首文本合同、旧template1兼容、template2引用/能力/恢复语义及schema验证，固定独审与公共输入交接。
- [ ] WPF-ATTACH01-02：资源持久上传/目录/正文/receipt恢复，原子pin与有界未使用资源清理；另exact amend后实施。
- [ ] WPF-ATTACH01-03：复用context冻结、Send/Queue/claim/recovery，PG/HTTP验证同材料及并发/重启/撤权；另exact amend后实施。
- [ ] WPF-ATTACH01-04：固定review、运行域交付与main接收，区分Web接线及单独provider验收。

当前写权只有[receipt](../../docs/evidence/wpf-attach01/take-receipt.json)五literal：attachments.ts、conversation-context.ts、attachments.test.ts及本plan/evidence目录；完整路径见status。F01继续持有client/exports/server mount；conversations.ts已移出但本claim尚未取得，026已预留但未取得迁移写权。本片不提前修改这些文件，不广告生产attachment能力。后续runtime仍本owner，不能把共享接线协调当等待他人实现后端。

冻结Interface见[interface](../../docs/evidence/wpf-attach01/interface.md)。首片project-bound UTF-8 text/plain .txt；最大8192原bytes，无截断；knowledge[]后attachments[]固定总序，合计4项/8192bytes。空attachments完全旧template1；非空附件template2严格分型。0模型；阶段验证局部schema/直接消费者和typecheck，不起DB或浏览器。未来PG/HTTP有独立DB/端口与原始证据。

skills与定段质量见[quality](../../docs/evidence/wpf-attach01/quality.md)。uploaded ready、草稿ownership、受理pin、审计retention严格分开；lookup404非未接受证明；namespace不是凭据或principal。完整MATURE03仍保留App输入/跨窗口/真实模型与后继类型验收。
