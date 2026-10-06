# MATURE02C01 · Claude 逐消息设置共享客户端

创建/更新：2026-10-06 16:39:08 UTC。状态：in-progress。所属大task：[WPF-MATURE-02](../../../claude-codex-capabilities/plans/wpf-mature-02-harness-capabilities/plan.md)；co-lead：ExecutionLead；owner：native_center_owner / gpt-6-astra。

目标：既有客户端与命令行可显式选择已配置的完整逐消息设置，并核对发送/入队接受回执，保留原请求身份和旧协议行为。按已批准 16:26 CORE handoff 实施；不重新设计合同，不创建 transport、设置状态机或自动重试。设计规则统一引用[根模块化规则](../../AGENTS.md#modular-design)。

## Interface 与职责

[固定接口](../../docs/evidence/mature02c01/interface.md)复用 FlowClient transport、现 acknowledgement Module 与 readJsonInput。CORE ea276 合同为受控输入，不写其非本scope路径；旧 F01 O14 CLI 三文件逐字保留为待验输入，不冒充本片已批准。

## TODO

- [x] MATURE02C01-01：核独立树/原子移交/固定合同及最小输入闭包，记录三件套与 Interface。
- [ ] MATURE02C01-02：实现版本目录、严格冻结回执与三个薄 CLI 命令；旧行为保留。
- [ ] MATURE02C01-03：必要纯函数/HTTP/CLI 与 focused types，保留实际原始输出及未运行界限。
- [ ] MATURE02C01-04：独立审查、修复、主线接收回执后释放。

验证只在 fresh ≥1 GiB+8 MiB 下进行；临时文件和raw总额≤8 MiB，每命令≤30秒，复用已安装第三方且@flow指本树；无安装/PG/provider/browser。只测本Module与直接消费者，不因文档更新重测。完整CORE/SDK/用户界面验收仍归父task。
