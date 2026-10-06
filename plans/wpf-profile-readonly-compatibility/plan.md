# WPF-PROFILEC02 只读 profile 选择兼容

创建/更新：2026-10-06 17:46:52 UTC；状态 in-progress。直接父 [WPF-MATURE-02](/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-codex-capabilities/plans/wpf-mature-02-harness-capabilities/plan.md)，co-lead Web /root（执行管理 d01_owner）。

固定基线 `4015c667f1e2b833755b2fda6ed205fb951ec576`。目录及写权见 [take receipt](../../docs/evidence/wpf-profile-readonly-compatibility/take-receipt.json)。本片只使 legacy Web selection 接受现有深只读配置，不交付 message-settings UI。

## Interface 与最小改动

`configuredSelection(input: Immutable<DirectoryProfile>)` 接受 mutable 或深 readonly 输入；现 `readDirectoryProfile(unknown)` 继续深克隆、完整 schema/metadata/controls 校验及 deep freeze，普通聊天 access 白名单不变。只修参数标注，不加 any/cast/复制解析器/新 UI。无新增运行成本、缓存或生命周期。

原 Picker52、selection73、现专测44 是真实只读消费者；原专测覆盖 HTTP 目录、授权失效、错误页、冻结创建与 ACK。必要定向 strict/noUncheckedIndexedAccess noEmit 与现专测，使用只读第三方入口和当前树固定 @flow source；不安装/补链接。整根 tsc 的独立 TUI controls 错误由其 owner 处理。

## TODO

- [ ] PROFILEC02-01 一行类型兼容并保留 parser/clone/access/controls。
- [ ] PROFILEC02-02 记录精确依赖、必要定向检查与固定来源。
- [ ] PROFILEC02-03 独立审查并接收 main。

## 验收与边界

首检查前明确真实只读依赖解析和运行入口；未准入的运行保持 NOT_RUN。45 shared 输入逐字保护，列表见 [研究来源](../../docs/evidence/wpf-profile-readonly-compatibility/readonly-proposal-sources.json)。不修改 shared、Recovery、App、Picker、deps 或全局索引。按根 AGENTS 模块/clean-code 规则窄审接口、错误处理及行为边界，无新架构图变更。
