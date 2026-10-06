# WPF-WORKSPACECACHE01 关闭会话与正文缓存生命周期

2026-10-06 11:35:14 UTC；in-progress。父 [WPF-MATURE-05](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/wpf-mature-05-workspace/plan.md)，co-lead Web /root。唯一owner workspace_panels_owner / gpt-6-astra ultra；独立worktree web-workspace-cache/codex同名，base fd1322f9c0c1d085d5e343e39f6216b20d26c264。遵循[根模块规则](../../AGENTS.md#modular-design)。

目标：关闭无本地材料的聊天时释放其宿主引用；保护草稿和未关闭收据；限制已读正文缓存。保留中心执行、唯一App视图权威与既有命令身份，不把关闭当取消。只本片16scope，[原领取](../../docs/evidence/wpf-workspace-cache/take-receipt.json)。

- [x] WPF-WORKSPACECACHE01-01：固定Interface与容量/保护规则，局部纯策略/读缓存行为。
- [x] WPF-WORKSPACECACHE01-02：接真实App/session/projection，关闭释放、保护重开与迟到隔离。
- [x] WPF-WORKSPACECACHE01-03：直接消费者与一次有界真实App HTTP差分验收，证据绑定固定源码。
- [x] WPF-WORKSPACECACHE01-04：独立review、正常push、主线接收与全scope停写交接（manager CAS回执另存）。

验收矩阵/限制见[Interface](../../docs/evidence/wpf-workspace-cache/interface.md)，技能与安全点记录见[quality](../../docs/evidence/wpf-workspace-cache/quality.md)。旧WORKSPACEPERF01为partial历史基线，不补其失败图或冒称32次关闭。新browser累计<=90秒（其中至少10秒清理）、原证据<=8MiB，失败先评估剩余预算，不自动超额重跑；0provider/个人服务/产品数据库。

ATTACHI后继与本片六literal重叠（App/session/两个projection/两个test）由管理串行交权。当前尚无App附件binding，附件items/pending composer submission/capture/journal unknown须由其实际binding提供保护事实，不能复制第二registry或称当前已验真实附件UI。Arc/feed/全历史与私有heap测量后继，不扩本片。

2026-10-06 11:57:35 UTC：main `017adc276a888a218bed3ef9963bc4dabbc6cec2` 已接收14源，与固定target逐字一致；本片交付完成，不表示MATURE05全部完成。owner停止全16scope，release由manager执行，不追加产品或预算实验。
